/** A single identified food item within a logged meal, editable before/after confirm. */
export interface FoodItem {
  id: string
  name: string
  estimatedGrams: number
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
  /** Open Food Facts product code this lookup resolved to, if any (barcode/text match). */
  offCode?: string
  /** True once the "Adjust for restaurant prep" nudge (Phase 3, Restaurant/Takeaway Mode) has
   * been applied to this item's calories/fat — gates the ConfirmLog button so it can't be tapped
   * twice and silently stack the multiplier. See eatingOutAdjustment.ts for the actual heuristic. */
  adjustedForEatingOut?: boolean
}

export interface Meal {
  id: string
  /** data: URL (JPEG) of the captured photo — stored inline for now; swapped for a Supabase
   * Storage URL once the real backend is wired in (see lib/supabase.ts).
   * Null for a voice-logged meal, which has no photo at all. For a menu-mode meal this holds the
   * PLATE photo when the user added one, else the menu photo itself — see MenuCapture.tsx's own
   * comment for why only one photo is kept per meal (Supabase Storage upload path only ever
   * handles a single blob, matching every other capture path). */
  photoDataUrl: string | null
  items: FoodItem[]
  loggedAt: string // ISO timestamp — already a full date+time (`new Date().toISOString()` in
  // ConfirmLog, `timestamptz` in Postgres), not just time-of-day. Nothing to add here for the
  // Phase 3 "full timestamp" requirement — MealTimeline.tsx just wasn't rendering the date part,
  // fixed there instead of here.
  /** "Eating Out" context tag (Phase 3, 2026-09-16) — settable on ANY entry (photo, voice, or
   * menu path), not just menu-mode ones. Distinct from whether a menu photo was used at all. */
  isEatingOut?: boolean
  /** Free-text restaurant/takeaway name, only meaningful when isEatingOut is true. No directory/
   * lookup — just what the user typed — used for the repeat-visit "you usually get X here"
   * suggestion in ConfirmLog (see resolveFoodItems.ts's findRepeatVisitSuggestion). */
  restaurantName?: string
}

export interface MacroTotals {
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
}

export function sumMacros(items: FoodItem[]): MacroTotals {
  return items.reduce(
    (acc, it) => ({
      calories: acc.calories + it.calories,
      proteinG: acc.proteinG + it.proteinG,
      fatG: acc.fatG + it.fatG,
      carbsG: acc.carbsG + it.carbsG,
    }),
    { calories: 0, proteinG: 0, fatG: 0, carbsG: 0 },
  )
}

export interface Goals {
  calorieGoal: number
  proteinGoalG: number
  fatGoalG: number
  carbsGoalG: number
}

export const DEFAULT_GOALS: Goals = {
  calorieGoal: 2200,
  proteinGoalG: 150,
  fatGoalG: 70,
  carbsGoalG: 220,
}
