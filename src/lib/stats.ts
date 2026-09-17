import type { Goals, Meal } from '@/lib/types'
import { sumMacros } from '@/lib/types'

/**
 * Phase 4 (Together Mode) — real, derived-from-data statistics shared by the tips ticker,
 * achievements/badges, and the "you" row of the Together Mode leaderboard. Every function here
 * is a pure computation over the SAME `meals` array App.tsx already loads from Supabase (see
 * mealsRepo.ts) — nothing here reads or writes any new table/column, so there is no migration to
 * run and no drift risk between "what's displayed" and "what's actually logged". Dates are
 * compared using the browser's local calendar day (`Date`'s local getters), matching how
 * MealTimeline already displays "today" vs a past date.
 */

function localDateKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface DayTotals {
  date: string // yyyy-mm-dd, local calendar day
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
  mealCount: number
}

/** Buckets every meal into its local calendar day and sums macros per day. */
export function groupMealsByDay(meals: Meal[]): Map<string, DayTotals> {
  const map = new Map<string, DayTotals>()
  for (const meal of meals) {
    const key = localDateKey(meal.loggedAt)
    const totals = sumMacros(meal.items)
    const existing = map.get(key)
    if (existing) {
      existing.calories += totals.calories
      existing.proteinG += totals.proteinG
      existing.fatG += totals.fatG
      existing.carbsG += totals.carbsG
      existing.mealCount += 1
    } else {
      map.set(key, { date: key, ...totals, mealCount: 1 })
    }
  }
  return map
}

/** Longest run ever, anywhere in history, of consecutive calendar days with >=1 meal logged. */
export function longestLoggingStreak(meals: Meal[]): { length: number; endDate: string | null } {
  const days = groupMealsByDay(meals)
  const sortedKeys = [...days.keys()].sort()
  if (sortedKeys.length === 0) return { length: 0, endDate: null }
  let best = 1
  let bestEnd = sortedKeys[0]
  let run = 1
  for (let i = 1; i < sortedKeys.length; i++) {
    const diffDays = Math.round(
      (new Date(sortedKeys[i]).getTime() - new Date(sortedKeys[i - 1]).getTime()) / 86_400_000,
    )
    run = diffDays === 1 ? run + 1 : 1
    if (run > best) {
      best = run
      bestEnd = sortedKeys[i]
    }
  }
  return { length: best, endDate: bestEnd }
}

/**
 * Streak still "alive" right now — walks back from today. If today has no meal logged yet, it
 * starts the walk from yesterday instead, so the streak doesn't drop to zero mid-day before the
 * user has had a chance to log anything today.
 */
export function currentLoggingStreak(meals: Meal[], now = new Date()): number {
  const days = groupMealsByDay(meals)
  const cursor = new Date(now)
  cursor.setHours(0, 0, 0, 0)
  if (!days.has(localDateKey(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  let streak = 0
  while (days.has(localDateKey(cursor.toISOString()))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Same "still alive" logic as currentLoggingStreak, but for consecutive days hitting the protein goal. */
export function currentProteinGoalStreak(meals: Meal[], goals: Goals, now = new Date()): number {
  const days = groupMealsByDay(meals)
  const cursor = new Date(now)
  cursor.setHours(0, 0, 0, 0)
  const hitsGoal = (key: string) => (days.get(key)?.proteinG ?? 0) >= goals.proteinGoalG
  if (!hitsGoal(localDateKey(cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1)
  }
  let streak = 0
  while (hitsGoal(localDateKey(cursor.toISOString()))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/** Longest run ever of consecutive days hitting the protein goal (for the "Protein Pro" badge). */
export function longestProteinGoalStreak(meals: Meal[], goals: Goals): number {
  const days = groupMealsByDay(meals)
  const sortedKeys = [...days.keys()].sort()
  let best = 0
  let run = 0
  let prevKey: string | null = null
  for (const key of sortedKeys) {
    const hit = (days.get(key)?.proteinG ?? 0) >= goals.proteinGoalG
    if (!hit) {
      run = 0
      prevKey = null
      continue
    }
    const diffDays = prevKey ? Math.round((new Date(key).getTime() - new Date(prevKey).getTime()) / 86_400_000) : null
    run = diffDays === 1 ? run + 1 : 1
    best = Math.max(best, run)
    prevKey = key
  }
  return best
}

/** De-duplicated, trimmed, case-insensitive set of every food name ever logged. */
export function uniqueFoodNames(meals: Meal[]): Set<string> {
  const set = new Set<string>()
  for (const m of meals) {
    for (const it of m.items) {
      const n = it.name.trim().toLowerCase()
      if (n) set.add(n)
    }
  }
  return set
}

/** The real calendar date (yyyy-mm-dd) the Nth distinct food name was first logged, chronologically. */
export function dateWhenUniqueFoodsReached(meals: Meal[], threshold: number): string | undefined {
  const sorted = [...meals].sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
  const seen = new Set<string>()
  for (const m of sorted) {
    for (const it of m.items) {
      const n = it.name.trim().toLowerCase()
      if (n) seen.add(n)
    }
    if (seen.size >= threshold) return m.loggedAt.slice(0, 10)
  }
  return undefined
}

/** Earliest "Eating Out" tagged meal, chronologically — real integration with Phase 3's isEatingOut field. */
export function firstEatingOutMeal(meals: Meal[]): Meal | null {
  const sorted = [...meals]
    .filter((m) => m.isEatingOut)
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt))
  return sorted[0] ?? null
}

/**
 * "Goal Crusher" score for the last 7 calendar days: 100 minus the average % deviation from the
 * calorie goal (only counting days something was actually logged), minus a 10-point penalty for
 * every one of those days that went OVER the goal — going over should rank worse than staying
 * under by the same margin, per the challenge's own name ("closest to goal WITHOUT going over").
 * Clamped to [0, 100]. Days with nothing logged simply don't count toward the average — they
 * neither help nor hurt the score, since "no data" isn't the same as "went over".
 */
export function goalCrusherWeekScore(meals: Meal[], goals: Goals, now = new Date()): number {
  const days = groupMealsByDay(meals)
  const cursor = new Date(now)
  cursor.setHours(0, 0, 0, 0)
  let totalDeviationPct = 0
  let daysLogged = 0
  let daysOverGoal = 0
  for (let i = 0; i < 7; i++) {
    const day = days.get(localDateKey(cursor.toISOString()))
    if (day && day.mealCount > 0) {
      daysLogged += 1
      totalDeviationPct += (Math.abs(goals.calorieGoal - day.calories) / goals.calorieGoal) * 100
      if (day.calories > goals.calorieGoal) daysOverGoal += 1
    }
    cursor.setDate(cursor.getDate() - 1)
  }
  if (daysLogged === 0) return 0
  const avgDeviationPct = totalDeviationPct / daysLogged
  return Math.max(0, Math.min(100, 100 - avgDeviationPct - daysOverGoal * 10))
}
