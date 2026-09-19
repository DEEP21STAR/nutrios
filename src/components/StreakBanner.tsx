import { useEffect, useState } from 'react'
import { Flame, Snowflake } from 'lucide-react'
import type { Meal } from '@/lib/types'
import { listMealsSince } from '@/lib/mealsRepo'
import { getStreakFreezeStatus, spendFreeze } from '@/lib/streakFreeze'
import { fireStreakConfetti } from '@/lib/confetti'
import { hapticSuccess } from '@/lib/haptics'

const HISTORY_DAYS = 14

/**
 * Today-tab streak indicator + the streak-freeze rescue prompt. Owns its own history fetch
 * (same pattern as TrendsHistory.tsx) rather than using App.tsx's `meals` prop -- that prop is
 * deliberately today-only for every existing Today-screen consumer (TodayRing, MealTimeline,
 * Achievements), and a streak genuinely needs multi-day history to compute at all. Wiring this to
 * the today-only prop was the first version's real bug: with only today's meal ever visible, a
 * streak could never read higher than 1 and a missed-day rescue could never be detected --
 * caught by seeding real multi-day test data and watching the rescue banner never appear.
 */
export function StreakBanner({ userId, todaysMealCount }: { userId: string | null; todaysMealCount: number }) {
  const [historyMeals, setHistoryMeals] = useState<Meal[] | null>(null)
  const [rescued, setRescued] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const since = new Date()
    since.setDate(since.getDate() - (HISTORY_DAYS - 1))
    since.setHours(0, 0, 0, 0)
    listMealsSince(userId, since.toISOString())
      .then((meals) => { if (!cancelled) setHistoryMeals(meals) })
      .catch(() => { if (!cancelled) setHistoryMeals([]) })
    return () => { cancelled = true }
    // Re-fetch whenever today's own meal count changes (a new log just happened) so the streak
    // reflects it immediately instead of waiting for the next full remount.
  }, [userId, todaysMealCount])

  if (!historyMeals) return null
  const status = getStreakFreezeStatus(historyMeals)
  if (status.effectiveStreak === 0 && !status.rescueDate) return null

  function handleRescue() {
    if (!status.rescueDate) return
    spendFreeze(status.rescueDate)
    setRescued(true)
    hapticSuccess()
    fireStreakConfetti()
  }

  return (
    <div className="glass-card mx-4 mt-4 flex w-[calc(100%-2rem)] items-center justify-between gap-3 p-4">
      <div className="flex items-center gap-2.5">
        <Flame size={20} className="text-accent-energy" style={{ filter: 'drop-shadow(0 0 6px var(--glow-energy))' }} />
        <div>
          <p className="text-body font-semibold">
            {status.effectiveStreak} day{status.effectiveStreak === 1 ? '' : 's'} logging streak
          </p>
          {status.freezesAvailable > 0 ? (
            <p className="flex items-center gap-1 text-caption text-text-tertiary">
              <Snowflake size={12} /> {status.freezesAvailable}/{status.maxBanked} freeze{status.maxBanked === 1 ? '' : 's'} banked
            </p>
          ) : (
            status.maxBanked < 3 && (
              <p className="text-caption text-text-tertiary">Premium banks up to 3 freezes</p>
            )
          )}
        </div>
      </div>

      {status.rescueDate && !rescued && (
        <button
          onClick={handleRescue}
          className="shrink-0 rounded-xl bg-accent-health px-3 py-2 text-caption font-semibold text-bg-primary"
        >
          Use a freeze
        </button>
      )}
      {rescued && <span className="shrink-0 text-caption text-accent-health">Streak saved</span>}
    </div>
  )
}
