import type { Goals, Meal } from '@/lib/types'
import {
  currentLoggingStreak,
  currentProteinGoalStreak,
  groupMealsByDay,
  uniqueFoodNames,
} from '@/lib/stats'

export interface Tip {
  id: string
  icon: string
  text: string
  /** 'personalized' tips are computed from this user's real logged data; 'generic' are static
   * nutrition/feature facts shown when there isn't enough real data yet to say something
   * personal. Exposed so the ticker can visually distinguish them if it ever wants to. */
  kind: 'personalized' | 'generic'
}

/**
 * Static fallback tips — nutrition facts and feature pointers, shown whenever real personalized
 * data runs out (new user, or just not enough history yet). None of these claim to be about
 * THIS user — no invented numbers, no fake streaks.
 */
const GENERIC_TIPS: Omit<Tip, 'kind'>[] = [
  { id: 'g-protein', icon: '💪', text: 'Protein takes the most energy to digest of any macro — it can help you feel full longer.' },
  { id: 'g-voice', icon: '🎙️', text: 'Not sure what you ate? Use Voice mode — the AI will ask follow-up questions if it needs more detail.' },
  { id: 'g-eatingout', icon: '🍽️', text: "Tag a meal as Eating Out to get a one-tap portion/prep adjustment for restaurant food." },
  { id: 'g-fiber', icon: '🌾', text: 'Whole grains, legumes, and vegetables are the main sources of dietary fibre.' },
  { id: 'g-water', icon: '💧', text: 'Thirst is sometimes mistaken for hunger — a glass of water before a meal is a cheap experiment.' },
  { id: 'g-menu', icon: '📋', text: 'At a restaurant? Photograph the menu first — the AI can read dish names straight off it.' },
  { id: 'g-edit', icon: '✏️', text: 'Every field on the confirm screen is editable — the AI is a first guess, not the final word.' },
  { id: 'g-consistency', icon: '📅', text: 'Logging something imperfectly every day beats logging perfectly some days — consistency compounds.' },
]

/** Personalized tips computed from real logged meal history. Each one only appears if the
 * underlying real condition is actually true right now — nothing here is guessed or seeded. */
function buildPersonalizedTips(meals: Meal[], goals: Goals): Tip[] {
  const tips: Tip[] = []

  const streak = currentLoggingStreak(meals)
  if (streak >= 2) {
    tips.push({
      id: 'p-streak',
      icon: '🔥',
      text: `You've logged ${streak} day${streak === 1 ? '' : 's'} in a row — keep it going.`,
      kind: 'personalized',
    })
  }

  const proteinStreak = currentProteinGoalStreak(meals, goals)
  if (proteinStreak >= 2) {
    tips.push({
      id: 'p-protein-streak',
      icon: '💪',
      text: `You've hit your protein goal ${proteinStreak} days straight.`,
      kind: 'personalized',
    })
  }

  const foods = uniqueFoodNames(meals)
  if (foods.size >= 10) {
    tips.push({
      id: 'p-variety',
      icon: '🌍',
      text: `You've logged ${foods.size} different foods so far — good variety.`,
      kind: 'personalized',
    })
  }

  const eatingOutCount = meals.filter((m) => m.isEatingOut).length
  if (meals.length >= 5 && eatingOutCount > 0) {
    const pct = Math.round((eatingOutCount / meals.length) * 100)
    tips.push({
      id: 'p-eating-out-ratio',
      icon: '🥡',
      text: `${pct}% of your logged meals have been eating-out — the restaurant-prep adjustment is there when you need it.`,
      kind: 'personalized',
    })
  }

  const days = groupMealsByDay(meals)
  const daysWithData = [...days.values()]
  if (daysWithData.length >= 3) {
    const avgCalories = daysWithData.reduce((a, d) => a + d.calories, 0) / daysWithData.length
    const diff = Math.round(avgCalories - goals.calorieGoal)
    if (Math.abs(diff) >= 100) {
      tips.push({
        id: 'p-avg-calories',
        icon: diff > 0 ? '⚖️' : '📉',
        text:
          diff > 0
            ? `Your daily average is ${Math.abs(diff)} kcal over your goal — worth a look at portions.`
            : `Your daily average is ${Math.abs(diff)} kcal under your goal.`,
        kind: 'personalized',
      })
    }
  }

  if (meals.length === 1) {
    tips.push({ id: 'p-first-meal', icon: '🎉', text: "You've logged your first meal — nice start.", kind: 'personalized' })
  }

  return tips
}

/**
 * Full tip list for the ticker: real personalized tips first (when available), generic
 * feature/nutrition facts filling the rest so the ticker never looks sparse for a brand-new
 * user with no history yet.
 */
export function generateTips(meals: Meal[], goals: Goals): Tip[] {
  const personalized = buildPersonalizedTips(meals, goals)
  const generic = GENERIC_TIPS.map((t) => ({ ...t, kind: 'generic' as const }))
  return [...personalized, ...generic]
}
