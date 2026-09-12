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
}

function rowToMeal(row: MealRow): Meal {
  return {
    id: row.id,
    photoDataUrl: row.photo_url ?? '',
    items: row.items,
    loggedAt: row.logged_at,
  }
}

/** Uploads the photo, then inserts the meal row. Returns the real, DB-assigned Meal. */
export async function insertMeal(userId: string, photoBlob: Blob, items: FoodItem[]): Promise<Meal> {
  const photoUrl = await uploadMealPhoto(photoBlob, userId)
  const totals = sumMacros(items)

  const { data, error } = await supabase
    .from('meals')
    .insert({
      user_id: userId,
      photo_url: photoUrl,
      items,
      total_calories: totals.calories,
      total_protein_g: totals.proteinG,
      total_fat_g: totals.fatG,
      total_carbs_g: totals.carbsG,
    })
    .select()
    .single<MealRow>()

  if (error || !data) throw new Error(`Failed to log meal: ${error?.message ?? 'no row returned'}`)
  return rowToMeal(data)
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
