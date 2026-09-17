import type { FoodItem, Meal } from '@/lib/types'

/**
 * "Eating Out" restaurant-prep adjustment (Phase 3, Restaurant/Takeaway Mode, 2026-09-16).
 *
 * HONEST BASIS FOR THIS NUMBER — read before changing it: this is NOT a peer-reviewed or
 * per-cuisine precise statistic. It's a deliberately modest, general nudge reflecting the
 * widely-repeated public-health observation (CDC/NHS-style eating-out guidance, and every major
 * restaurant-nutrition writeup) that restaurant and takeaway kitchens typically use more added
 * oil/butter/salt in preparation and serve larger portions than a typical home-cooked equivalent
 * of the same dish name — NOT that any specific restaurant uses exactly this much more. Chosen
 * to be smaller than the most-cited "restaurant meals average ~200+ extra kcal" figures (which
 * vary hugely by cuisine and aren't something this app can verify per-item), so it under-corrects
 * rather than over-corrects. It is:
 *   - NEVER applied automatically or silently — it's a one-tap button in ConfirmLog, visible only
 *     when "Eating Out" is on, and every macro field stays editable before and after.
 *   - Applied at most once per item (gated by `adjustedForEatingOut`) so repeated taps can't stack.
 *   - Calories and fat only — protein/carbs are left alone, since "more oil" is specifically a fat
 *     story, not a protein/carb one.
 */
export const EATING_OUT_CALORIE_MULTIPLIER = 1.15
export const EATING_OUT_FAT_MULTIPLIER = 1.2

export function applyEatingOutAdjustment(item: FoodItem): FoodItem {
  if (item.adjustedForEatingOut) return item
  return {
    ...item,
    calories: Math.round(item.calories * EATING_OUT_CALORIE_MULTIPLIER),
    fatG: Math.round(item.fatG * EATING_OUT_FAT_MULTIPLIER * 10) / 10,
    adjustedForEatingOut: true,
  }
}

/**
 * Repeat-visit memory (Phase 3 stretch, item 5). Pure client-side lookup against meals already
 * loaded into App.tsx's state — no new backend query. Matches on a trimmed, case-insensitive
 * restaurant name so "Nando's" and "nando's " hit the same history. Returns null when there's no
 * real prior visit to that restaurant, or when every prior visit there logged zero named items
 * (nothing useful to suggest) — callers should treat null as "say nothing", not as an error.
 */
export interface RepeatVisitSuggestion {
  restaurantName: string
  visitCount: number
  /** De-duplicated item names ordered by how often they appear across past visits, most first. */
  commonItemNames: string[]
  /** One representative past visit's items, ready to clone into the current draft with fresh ids. */
  sampleItems: FoodItem[]
}

export function findRepeatVisitSuggestion(
  pastMeals: Meal[],
  restaurantName: string,
  excludeMealId?: string,
): RepeatVisitSuggestion | null {
  const needle = restaurantName.trim().toLowerCase()
  if (!needle) return null

  const visits = pastMeals.filter(
    (m) => m.id !== excludeMealId && m.isEatingOut && m.restaurantName?.trim().toLowerCase() === needle,
  )
  if (visits.length === 0) return null

  const counts = new Map<string, number>()
  for (const visit of visits) {
    for (const item of visit.items) {
      const key = item.name.trim()
      if (!key) continue
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  if (counts.size === 0) return null

  const commonItemNames = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name)

  // Most recent visit (loggedAt descending) makes the best "clone these items" starting point —
  // freshest macros/portions, not an arbitrary or oldest one.
  const mostRecent = [...visits].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))[0]

  return {
    restaurantName: mostRecent.restaurantName ?? restaurantName,
    visitCount: visits.length,
    commonItemNames,
    sampleItems: mostRecent.items,
  }
}
