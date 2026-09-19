import { describe, expect, it } from 'vitest'
import { calculateBMR, calculateGoals, calculateTDEE } from '@/lib/bmr'

describe('calculateBMR (Mifflin-St Jeor)', () => {
  it('adds +5 for male', () => {
    expect(calculateBMR('male', 80, 178, 32)).toBeCloseTo(10 * 80 + 6.25 * 178 - 5 * 32 + 5)
  })

  it('subtracts 161 for female', () => {
    expect(calculateBMR('female', 65, 165, 28)).toBeCloseTo(10 * 65 + 6.25 * 165 - 5 * 28 - 161)
  })
})

describe('calculateTDEE', () => {
  it('applies the sedentary multiplier', () => {
    expect(calculateTDEE(1600, 'sedentary')).toBeCloseTo(1600 * 1.2)
  })

  it('applies the very_active multiplier', () => {
    expect(calculateTDEE(1600, 'very_active')).toBeCloseTo(1600 * 1.725)
  })
})

describe('calculateGoals (full onboarding pipeline)', () => {
  it('produces a lower calorie target than maintenance when losing weight', () => {
    const base = { sex: 'male' as const, age: 32, heightCm: 178, weightKg: 80, activityLevel: 'moderate' as const }
    const maintain = calculateGoals({ ...base, goalDirection: 'maintain', goalRateKgPerWeek: 0 })
    const lose = calculateGoals({ ...base, goalDirection: 'lose', goalRateKgPerWeek: 0.5 })
    expect(lose.calorieGoal).toBeLessThan(maintain.calorieGoal)
  })

  it('produces a higher calorie target than maintenance when gaining weight', () => {
    const base = { sex: 'female' as const, age: 28, heightCm: 165, weightKg: 65, activityLevel: 'light' as const }
    const maintain = calculateGoals({ ...base, goalDirection: 'maintain', goalRateKgPerWeek: 0 })
    const gain = calculateGoals({ ...base, goalDirection: 'gain', goalRateKgPerWeek: 0.5 })
    expect(gain.calorieGoal).toBeGreaterThan(maintain.calorieGoal)
  })

  it('never returns negative carbs even on an aggressive cut', () => {
    const goals = calculateGoals({
      sex: 'female',
      age: 45,
      heightCm: 150,
      weightKg: 50,
      activityLevel: 'sedentary',
      goalDirection: 'lose',
      goalRateKgPerWeek: 1,
    })
    expect(goals.carbsGoalG).toBeGreaterThanOrEqual(0)
  })

  it('sets protein at ~2g per kg bodyweight', () => {
    const goals = calculateGoals({
      sex: 'male',
      age: 30,
      heightCm: 180,
      weightKg: 90,
      activityLevel: 'moderate',
      goalDirection: 'maintain',
      goalRateKgPerWeek: 0,
    })
    expect(goals.proteinGoalG).toBe(180)
  })
})
