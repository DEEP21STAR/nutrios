import { useEffect, useMemo } from 'react'
import type { Goals, Meal } from '@/lib/types'
import { computeBadges, getNewlyEarnedBadges, type Badge } from '@/lib/achievements'
import { cn } from '@/lib/utils'
import { fireConfetti, fireStreakConfetti } from '@/lib/confetti'

/**
 * Achievements/badges (Phase 4) — every badge is computed live from the real `meals` array
 * App.tsx already loads from Supabase, via src/lib/achievements.ts. No invented progress number:
 * a locked badge shows the real current count against the real target (e.g. "4/7 days"), not a
 * decorative bar. See achievements.ts's own header comment for why this is fully client-computed
 * rather than backed by a new Supabase table/column.
 */
export function Achievements({ meals, goals }: { meals: Meal[]; goals: Goals }) {
  const badges = useMemo(() => computeBadges(meals, goals), [meals, goals])
  const earnedCount = badges.filter((b) => b.earned).length

  // Fire a celebration exactly once per newly-earned badge (per device — see achievements.ts).
  // Runs after every real meals/goals change, not on every render, via the same dependency array.
  useEffect(() => {
    const newly = getNewlyEarnedBadges(badges)
    for (const badge of newly) {
      if (badge.celebration === 'streak') fireStreakConfetti()
      else fireConfetti()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals, goals])

  return (
    <section className="mt-6 px-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-subtitle text-text-primary">Achievements</h2>
        <span className="text-caption text-text-tertiary">
          {earnedCount}/{badges.length}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {badges.map((badge) => (
          <BadgeCard key={badge.id} badge={badge} />
        ))}
      </div>
    </section>
  )
}

function BadgeCard({ badge }: { badge: Badge }) {
  const pct = Math.min(100, (badge.progressCurrent / badge.progressTarget) * 100)
  return (
    <div
      className={cn(
        'glass-card flex flex-col items-center gap-1 p-3 text-center',
        badge.earned ? 'shadow-[0_0_16px_2px_var(--glow-health)]' : 'opacity-70',
      )}
    >
      <span className="text-2xl" aria-hidden>
        {badge.icon}
      </span>
      <span className="text-caption font-semibold text-text-primary">{badge.title}</span>
      <span className="text-caption leading-tight text-text-tertiary">{badge.description}</span>
      {badge.earned ? (
        <span className="mt-1 text-caption text-accent-health">
          ✓ Earned{badge.earnedOn ? ` · ${badge.earnedOn}` : ''}
        </span>
      ) : (
        <div className="mt-1 w-full">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-tertiary">
            <div className="h-full rounded-full bg-accent-ai transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="mt-0.5 block text-caption text-text-tertiary">
            {badge.progressCurrent}/{badge.progressTarget}
          </span>
        </div>
      )}
    </div>
  )
}
