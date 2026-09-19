import type { Meal } from '@/lib/types'
import { currentLoggingStreak, groupMealsByDay } from '@/lib/stats'
import { isPremiumUnlocked } from '@/lib/premium'

/**
 * Streak-freeze — protects a logging streak from breaking on a single missed day (Duolingo's
 * well-established pattern). Client-side/localStorage only, same tier as premium.ts and
 * achievements' seen-badges state: this is a motivational nicety, not account data that needs to
 * survive a device switch, so it doesn't need a migration or a new Supabase table.
 *
 * A freeze is earned every 7 real (unfrozen) consecutive days logged, capped at 2 banked at once
 * — matching Duolingo's own cap, which exists for the same reason here: an unbounded bank turns
 * the mechanic into "streaks never break", which defeats the point.
 */

const STATE_KEY = 'nutrios.streakFreeze.v1'
const MAX_BANKED_FREE = 1
const MAX_BANKED_PREMIUM = 3

interface FreezeState {
  freezesAvailable: number
  /** yyyy-mm-dd days a freeze has already been spent on — never re-spent, and counted as a
   * logged day when walking the streak. */
  frozenDates: string[]
  /** The last raw (unfrozen) streak length a freeze was awarded for, so crossing the same
   * multiple of 7 twice in one render doesn't double-award. */
  lastAwardedAtStreak: number
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function loadState(): FreezeState {
  try {
    const raw = localStorage.getItem(STATE_KEY)
    if (!raw) return { freezesAvailable: 0, frozenDates: [], lastAwardedAtStreak: 0 }
    const parsed = JSON.parse(raw)
    return {
      freezesAvailable: parsed.freezesAvailable ?? 0,
      frozenDates: Array.isArray(parsed.frozenDates) ? parsed.frozenDates : [],
      lastAwardedAtStreak: parsed.lastAwardedAtStreak ?? 0,
    }
  } catch {
    return { freezesAvailable: 0, frozenDates: [], lastAwardedAtStreak: 0 }
  }
}

function saveState(state: FreezeState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    // Private-browsing/storage-blocked — freeze state just won't persist, not a crash.
  }
}

/** Same "still alive" logic as stats.ts's currentLoggingStreak, but treats frozen dates as if a
 * meal had been logged that day. */
export function currentStreakWithFreezes(meals: Meal[], frozenDates: string[], now = new Date()): number {
  const days = groupMealsByDay(meals)
  const frozenSet = new Set(frozenDates)
  const hasDay = (key: string) => days.has(key) || frozenSet.has(key)
  const cursor = new Date(now)
  cursor.setHours(0, 0, 0, 0)
  if (!hasDay(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (hasDay(localDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

/**
 * The one specific date (always yesterday) a banked freeze could rescue right now, or null if
 * there's nothing to rescue. Deliberately does NOT require today to still be unlogged — this
 * needs to work retroactively too (open the app a day late, already logged today, yesterday's
 * still a real gap) as well as proactively, same as Duolingo's own freeze, which patches a gap
 * whenever it's next seen rather than only in the moment it happens. Only ever a single day:
 * a 2+ day gap means the day before yesterday is empty too, which the second check below catches
 * and correctly refuses (one freeze bridges one day, not an abandoned streak).
 */
function rescuableDate(meals: Meal[], frozenDates: string[], now = new Date()): string | null {
  const days = groupMealsByDay(meals)
  const frozenSet = new Set(frozenDates)
  const cursor = new Date(now)
  cursor.setHours(0, 0, 0, 0)

  cursor.setDate(cursor.getDate() - 1)
  const gapKey = localDateKey(cursor)
  if (days.has(gapKey) || frozenSet.has(gapKey)) return null // yesterday's fine, no gap

  cursor.setDate(cursor.getDate() - 1)
  const beforeGapKey = localDateKey(cursor)
  if (!days.has(beforeGapKey) && !frozenSet.has(beforeGapKey)) return null // nothing before the gap to protect

  return gapKey
}

export interface StreakFreezeStatus {
  /** Real streak, ignoring freezes — what stats.ts's currentLoggingStreak already computes. */
  rawStreak: number
  /** Streak length once banked freezes covering past gaps are counted. */
  effectiveStreak: number
  freezesAvailable: number
  /** 1 on the free tier, 3 with Premium unlocked — surfaced so the UI can point at Premium once
   * the free cap is hit, without hardcoding the number twice. */
  maxBanked: number
  /** Set when there's a missed day right now that a freeze could rescue. */
  rescueDate: string | null
}

/** Call with multi-day meal history (StreakBanner.tsx fetches its own — see that file's header
 * comment for why this can't use App.tsx's shared `meals` prop, which is today-only). Also
 * handles awarding a new freeze if the raw streak just crossed a fresh multiple of 7. */
export function getStreakFreezeStatus(meals: Meal[], now = new Date()): StreakFreezeStatus {
  const state = loadState()
  const rawStreak = currentLoggingStreak(meals, now)
  const maxBanked = isPremiumUnlocked() ? MAX_BANKED_PREMIUM : MAX_BANKED_FREE

  if (rawStreak > 0 && rawStreak % 7 === 0 && rawStreak !== state.lastAwardedAtStreak && state.freezesAvailable < maxBanked) {
    state.freezesAvailable += 1
    state.lastAwardedAtStreak = rawStreak
    saveState(state)
  }

  return {
    rawStreak,
    effectiveStreak: currentStreakWithFreezes(meals, state.frozenDates, now),
    freezesAvailable: state.freezesAvailable,
    maxBanked,
    rescueDate: state.freezesAvailable > 0 ? rescuableDate(meals, state.frozenDates, now) : null,
  }
}

/** Spends one banked freeze on the given date. Returns the freeze count remaining. */
export function spendFreeze(date: string): number {
  const state = loadState()
  if (state.freezesAvailable <= 0 || state.frozenDates.includes(date)) return state.freezesAvailable
  state.freezesAvailable -= 1
  state.frozenDates = [...state.frozenDates, date]
  saveState(state)
  return state.freezesAvailable
}
