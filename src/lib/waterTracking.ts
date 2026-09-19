/**
 * Water tracking — free for everyone. Real competitor finding from earlier research: MyFitnessPal
 * gates *custom* water tracking behind Premium. A simple daily counter, free here, is a cheap,
 * concrete lead over the category's biggest name.
 *
 * Client-side/localStorage, same tier as streak-freeze/achievements state — water intake resets
 * daily and doesn't need cross-device history the way meals/goals do, so this deliberately skips
 * a migration rather than adding backend storage for a same-day-only counter.
 */

const STATE_KEY = 'nutrios.water.v1'
export const WATER_GOAL_ML = 2500 // standard general adult recommendation (~8 cups)

interface WaterState {
  date: string // yyyy-mm-dd, local calendar day -- resets automatically once this stops matching today
  ml: number
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadState(): WaterState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return { date: todayKey(), ml: 0 }
    const parsed = JSON.parse(raw) as WaterState
    if (parsed.date !== todayKey()) return { date: todayKey(), ml: 0 } // new day, real reset
    return parsed
  } catch {
    return { date: todayKey(), ml: 0 }
  }
}

function saveState(state: WaterState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // Private-browsing/storage-blocked -- today's count just won't persist across reloads.
  }
}

export function getTodayWaterMl(): number {
  return loadState().ml
}

export function addWaterMl(amountMl: number): number {
  const state = loadState()
  state.ml = Math.max(0, state.ml + amountMl)
  saveState(state)
  return state.ml
}
