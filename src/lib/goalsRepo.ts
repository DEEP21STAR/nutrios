import { supabase } from '@/lib/supabase'
import type { Goals } from '@/lib/types'

/**
 * Real Supabase-backed goals, matching the `goals` table already defined in
 * supabase/migrations/0001_init.sql (one row per user, upserted on
 * onboarding completion). This table has existed since the very first
 * migration but nothing in the app ever read or wrote it until now — every
 * screen used the hardcoded DEFAULT_GOALS constant instead.
 */
interface GoalsRow {
  user_id: string
  calorie_goal: number
  protein_goal_g: number
  fat_goal_g: number
  carbs_goal_g: number
}

function rowToGoals(row: GoalsRow): Goals {
  return {
    calorieGoal: row.calorie_goal,
    proteinGoalG: row.protein_goal_g,
    fatGoalG: row.fat_goal_g,
    carbsGoalG: row.carbs_goal_g,
  }
}

/** Returns null when the user hasn't completed onboarding yet — the caller uses that to decide
 * whether to show the OnboardingWizard, not an error. */
export async function fetchGoals(userId: string): Promise<Goals | null> {
  const { data, error } = await supabase.from('goals').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`Failed to load goals: ${error.message}`)
  return data ? rowToGoals(data as GoalsRow) : null
}

/** Upsert since a user re-running onboarding (rare, but possible) should overwrite, not duplicate. */
export async function saveGoals(userId: string, goals: Goals): Promise<void> {
  const { error } = await supabase.from('goals').upsert({
    user_id: userId,
    calorie_goal: goals.calorieGoal,
    protein_goal_g: goals.proteinGoalG,
    fat_goal_g: goals.fatGoalG,
    carbs_goal_g: goals.carbsGoalG,
  })
  if (error) throw new Error(`Failed to save goals: ${error.message}`)
}
