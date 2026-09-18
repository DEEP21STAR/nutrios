import type { Goals } from '@/lib/types'

export type Sex = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active'
export type GoalDirection = 'lose' | 'maintain' | 'gain'

export interface OnboardingAnswers {
  sex: Sex
  age: number
  heightCm: number
  weightKg: number
  activityLevel: ActivityLevel
  goalDirection: GoalDirection
  /** kg per week, only meaningful when goalDirection !== 'maintain'. Positive number regardless
   * of direction — the sign is applied by calculateGoals below. */
  goalRateKgPerWeek: number
}

/** Real activity multipliers (Mifflin-St Jeor / TDEE convention) — not invented. */
const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
}

/** 1kg of bodyweight change ≈ 7700 kcal, the standard real-world approximation used by
 * MyFitnessPal/MacroFactor-style calculators (not the older, less accurate 3500kcal/lb figure
 * misapplied to kg). */
const KCAL_PER_KG = 7700

/**
 * Mifflin-St Jeor equation — the NIH-recommended BMR formula, more accurate than the older
 * Harris-Benedict equation it replaced. Real, sourced formula, not approximated.
 */
export function calculateBMR(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  return sex === 'male' ? base + 5 : base - 161
}

export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return bmr * ACTIVITY_FACTORS[activityLevel]
}

/**
 * Full pipeline: BMR -> TDEE -> goal-adjusted calorie target -> macro split.
 * Macro split matches the research brief: protein ~2g/kg bodyweight, fat ~25% of calories,
 * carbs fill the remainder — the same convention MyFitnessPal/MacroFactor-style tools use.
 */
export function calculateGoals(answers: OnboardingAnswers): Goals {
  const bmr = calculateBMR(answers.sex, answers.weightKg, answers.heightCm, answers.age)
  const tdee = calculateTDEE(bmr, answers.activityLevel)

  const dailyKcalDelta = (answers.goalRateKgPerWeek * KCAL_PER_KG) / 7
  const signedDelta =
    answers.goalDirection === 'lose' ? -dailyKcalDelta : answers.goalDirection === 'gain' ? dailyKcalDelta : 0
  const calorieGoal = Math.round(tdee + signedDelta)

  const proteinGoalG = Math.round(answers.weightKg * 2)
  const fatGoalG = Math.round((calorieGoal * 0.25) / 9)
  const proteinKcal = proteinGoalG * 4
  const fatKcal = fatGoalG * 9
  const carbsGoalG = Math.max(0, Math.round((calorieGoal - proteinKcal - fatKcal) / 4))

  return { calorieGoal, proteinGoalG, fatGoalG, carbsGoalG }
}
