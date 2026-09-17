import type { Goals, Meal } from '@/lib/types'
import { currentLoggingStreak, currentProteinGoalStreak, goalCrusherWeekScore } from '@/lib/stats'

/**
 * Together Mode — social leaderboard/podium (Phase 4).
 *
 * REAL ARCHITECTURE CONSTRAINT, documented honestly rather than hand-waved (see auth.ts):
 * this app authenticates every user via Supabase anonymous sign-in (`signInAnonymously()`) —
 * there is no email/password/named identity, no friend list, no invite mechanism, and no way for
 * one anonymous user's client to ever legitimately see another anonymous user's rows (RLS is
 * scoped to `auth.uid()`, by design, for a single-user personal app). Building a REAL multi-person
 * leaderboard needs one of:
 *   (a) A real invite/friend-connection system with actual named identity (email/password or
 *       OAuth sign-in, a friendships table, invite links) — a genuine auth-model change, well
 *       beyond a safe scope to build and ship unverified overnight.
 *   (b) A clearly-labeled DEMO/preview of the UI and mechanics, with sample "friend" data that is
 *       unmistakably fake, while your OWN row/stats are computed for real from your actual logged
 *       meals.
 *
 * Chose (b). Every function below that touches a real person only ever computes from the real
 * `meals`/`goals` the caller already has (same data source as achievements.ts/tips.ts). The
 * DEMO_FRIENDS below are fixed, fictional, and clearly commented as sample data — never fetched
 * from any backend, never randomized per-session (so they don't look like they're "live" or
 * "real people who happen to always lose/win"). The UI (TogetherMode.tsx) renders an explicit,
 * non-truncatable "DEMO" badge next to every one of these rows — deliberately NOT baked into the
 * name string itself, since an early version of this screen truncated "(demo)" off the end of a
 * long name on the podium, which would have silently hidden the exact disclosure this whole
 * feature exists to make unmistakable.
 */

export type ChallengeType = 'protein' | 'consistency' | 'goalCrusher'

export const CHALLENGES: { id: ChallengeType; label: string; description: string; unit: string }[] = [
  { id: 'protein', label: 'Protein Streak', description: 'Most consecutive days hitting your protein goal', unit: 'days' },
  { id: 'consistency', label: 'Consistency Streak', description: 'Most consecutive days logged, showing up beats perfection', unit: 'days' },
  { id: 'goalCrusher', label: 'Goal Crusher', description: 'Closest to your calorie goal without going over, last 7 days', unit: 'pts' },
]

export interface LeaderboardEntry {
  id: string
  name: string
  avatar: string
  value: number
  isYou: boolean
  isDemo: boolean
}

/**
 * SAMPLE DATA — these are not real people, not fetched from any backend, not synced anywhere.
 * Fixed on purpose (not randomized) so re-rendering doesn't make the "demo" leaderboard look like
 * it's live. seed values are per-challenge so the demo podium reshuffles sensibly when the
 * challenge tab changes, exactly like real varied performance would.
 */
const DEMO_FRIENDS: { name: string; avatar: string; seeds: Record<ChallengeType, number> }[] = [
  { name: 'Alex', avatar: '🦸', seeds: { protein: 5, consistency: 12, goalCrusher: 61 } },
  { name: 'Priya', avatar: '🌟', seeds: { protein: 9, consistency: 4, goalCrusher: 78 } },
  { name: 'Jordan', avatar: '🚀', seeds: { protein: 2, consistency: 21, goalCrusher: 45 } },
  { name: 'Mika', avatar: '🎯', seeds: { protein: 6, consistency: 8, goalCrusher: 83 } },
]

/** Real value for the current user, computed from their actual logged meals/goals — no sample data involved. */
export function computeYourChallengeValue(challenge: ChallengeType, meals: Meal[], goals: Goals): number {
  switch (challenge) {
    case 'protein':
      return currentProteinGoalStreak(meals, goals)
    case 'consistency':
      return currentLoggingStreak(meals)
    case 'goalCrusher':
      return Math.round(goalCrusherWeekScore(meals, goals))
  }
}

export function buildLeaderboard(
  challenge: ChallengeType,
  meals: Meal[],
  goals: Goals,
  yourDisplayName: string,
): LeaderboardEntry[] {
  const yourValue = computeYourChallengeValue(challenge, meals, goals)
  const demoEntries: LeaderboardEntry[] = DEMO_FRIENDS.map((f) => ({
    id: f.name,
    name: f.name,
    avatar: f.avatar,
    value: f.seeds[challenge],
    isYou: false,
    isDemo: true,
  }))
  const you: LeaderboardEntry = {
    id: 'you',
    name: yourDisplayName.trim() || 'You',
    avatar: '🙂',
    value: yourValue,
    isYou: true,
    isDemo: false,
  }
  return [...demoEntries, you].sort((a, b) => b.value - a.value)
}

// ---------------------------------------------------------------------------
// Privacy-tiered sharing settings — REAL, working, client-side-only setting.
// Mirrors Samsung Health's own three tiers exactly (per the earlier research
// in project memory) rather than inventing a weaker version. There is no
// real backend to actually broadcast to yet (see the constraint above), so
// this setting currently only controls whether YOUR row appears in this
// device's own preview leaderboard — an honest, working default for when
// the real friend/sharing backend does ship, not a decorative toggle.
// ---------------------------------------------------------------------------

export type ShareLevel = 'everyone' | 'friends' | 'none'

export interface TogetherSettings {
  shareLevel: ShareLevel
  displayName: string
}

const SETTINGS_KEY = 'nutrios.together.settings'

const DEFAULT_SETTINGS: TogetherSettings = {
  // Privacy-first default (more conservative than Samsung's own default), per project memory:
  // diet data is more sensitive than step counts, so this app defaults to the most private tier
  // rather than "everyone".
  shareLevel: 'friends',
  displayName: '',
}

export function loadTogetherSettings(): TogetherSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveTogetherSettings(settings: TogetherSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* no-op — private browsing / storage disabled; setting just won't persist across reloads */
  }
}
