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
}

export interface Meal {
  id: string
  /** data: URL (JPEG) of the captured photo — stored inline for now; swapped for a Supabase
   * Storage URL once the real backend is wired in (see lib/supabase.ts). */
  photoDataUrl: string
  items: FoodItem[]
  loggedAt: string // ISO timestamp
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
