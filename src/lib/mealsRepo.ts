import { supabase } from '@/lib/supabase'
import { uploadMealPhoto } from '@/lib/storage'
import { sumMacros, type FoodItem, type Meal } from '@/lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Real Supabase-backed replacement for the in-memory mock meals array. Every
 * function here talks to the live project (ddbybgmysfvsxhadudne) — no mock
 * data. Row shape matches supabase/migrations/0001_init.sql's `meals` table.
 */
interface MealRow {
  id: string
  user_id: string
  photo_url: string | null
  items: FoodItem[]
  total_calories: number
  total_protein_g: number
  total_fat_g: number
  total_carbs_g: number
  logged_at: string
  // Optional: only present once supabase/migrations/0002_eating_out.sql has actually been run —
  // see insertMeal's fallback below for what happens before that.
  is_eating_out?: boolean
  restaurant_name?: string | null
}

function rowToMeal(row: MealRow): Meal {
  return {
    id: row.id,
    photoDataUrl: row.photo_url ?? '',
    items: row.items,
    loggedAt: row.logged_at,
    isEatingOut: row.is_eating_out ?? undefined,
    restaurantName: row.restaurant_name ?? undefined,
  }
}

/**
 * Uploads the photo (when there is one), then inserts the meal row. Returns
 * the real, DB-assigned Meal. `photoBlob` is null for a voice-logged meal —
 * the `meals` table's `photo_url` column already allows null (see
 * supabase/migrations/0001_init.sql), so this just skips the Storage upload
 * entirely rather than inventing a placeholder image.
 *
 * `isEatingOut`/`restaurantName` (Phase 3, 2026-09-16) need the two new columns from
 * supabase/migrations/0002_eating_out.sql, which — like 0001 before it — requires a one-time
 * manual run in the Supabase SQL Editor (no DDL access from this app's anon key). Rather than
 * make every meal log fail until that's done, this tries the full insert first and, ONLY on
 * PostgREST's specific "column not found in schema cache" error (code PGRST204, or the matching
 * message text as a fallback check), retries without the two new fields. Any other error still
 * throws normally. The caller (App.tsx) gets a real Meal back either way; it just won't have
 * survived to the DB with the eating-out tag until the migration is applied.
 */
export async function insertMeal(
  userId: string,
  photoBlob: Blob | null,
  items: FoodItem[],
  meta?: { isEatingOut?: boolean; restaurantName?: string },
): Promise<Meal> {
  const photoUrl = photoBlob ? await uploadMealPhoto(photoBlob, userId) : null
  const totals = sumMacros(items)

  const basePayload = {
    user_id: userId,
    photo_url: photoUrl,
    items,
    total_calories: totals.calories,
    total_protein_g: totals.proteinG,
    total_fat_g: totals.fatG,
    total_carbs_g: totals.carbsG,
  }
  const eatingOutFields = meta?.isEatingOut
    ? { is_eating_out: true, restaurant_name: meta.restaurantName?.trim() || null }
    : {}

  let { data, error } = await supabase
    .from('meals')
    .insert({ ...basePayload, ...eatingOutFields })
    .select()
    .single<MealRow>()

  if (error && Object.keys(eatingOutFields).length > 0 && isMissingColumnError(error)) {
    console.warn(
      '[mealsRepo] is_eating_out/restaurant_name column(s) not found — run supabase/migrations/0002_eating_out.sql. ' +
        'Retrying this insert without them (meal will still save, just without the eating-out tag persisted).',
    )
    ;({ data, error } = await supabase.from('meals').insert(basePayload).select().single<MealRow>())
    if (!error && data) {
      // Column doesn't exist server-side yet, but the caller still asked for the tag — keep it
      // in the returned in-memory Meal so the current session's UI (ConfirmLog/MealTimeline)
      // shows it correctly even though it won't survive a reload until the migration runs.
      return { ...rowToMeal(data), isEatingOut: meta?.isEatingOut, restaurantName: meta?.restaurantName }
    }
  }

  if (error || !data) throw new Error(`Failed to log meal: ${error?.message ?? 'no row returned'}`)
  return rowToMeal(data)
}

function isMissingColumnError(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST204' || /column .* (does not exist|not found)/i.test(error.message ?? '')
}

/** All of today's meals for this user, newest first is handled by the caller/UI. */
export async function listTodayMeals(userId: string): Promise<Meal[]> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', startOfDay.toISOString())
    .order('logged_at', { ascending: true })
    .returns<MealRow[]>()

  if (error) throw new Error(`Failed to load meals: ${error.message}`)
  return (data ?? []).map(rowToMeal)
}

/**
 * Real historical range, oldest first (Phase 5, Trends & History, 2026-09-17) — same table, same
 * RLS-scoped query shape as listTodayMeals above, just parameterized by a real start date instead
 * of "today" so TrendsHistory.tsx's weekly calorie bar chart can aggregate real multi-day data.
 * Deliberately a separate function/query rather than widening listTodayMeals's range: the Today
 * screen's own consumers (TodayRing, MealTimeline, Achievements, TogetherMode) all intentionally
 * see only today's meals, and this keeps that behaviour untouched.
 */
export async function listMealsSince(userId: string, sinceISO: string): Promise<Meal[]> {
  const { data, error } = await supabase
    .from('meals')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', sinceISO)
    .order('logged_at', { ascending: true })
    .returns<MealRow[]>()

  if (error) throw new Error(`Failed to load meal history: ${error.message}`)
  return (data ?? []).map(rowToMeal)
}

/**
 * Realtime subscription for cross-device live sync (spec requirement): any
 * insert to this user's own meals (RLS still applies — a client only ever
 * receives rows it's allowed to select) triggers `onInsert` with the new row.
 */
export function subscribeToMeals(userId: string, onInsert: (meal: Meal) => void): RealtimeChannel {
  return supabase
    .channel(`meals-${userId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'meals', filter: `user_id=eq.${userId}` },
      (payload) => onInsert(rowToMeal(payload.new as MealRow)),
    )
    .subscribe()
}
