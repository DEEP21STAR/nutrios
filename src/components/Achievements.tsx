import { useEffect, useMemo, useState } from 'react'
import { Share2 } from 'lucide-react'
import type { Goals, Meal } from '@/lib/types'
import { computeBadges, getNewlyEarnedBadges, type Badge } from '@/lib/achievements'
import { cn } from '@/lib/utils'
import { fireConfetti, fireStreakConfetti, fireBullseyeConfetti } from '@/lib/confetti'
import { hapticCelebrate, hapticTap } from '@/lib/haptics'
import { MilestoneShareCard } from '@/components/MilestoneShareCard'

/**
 * Achievements/badges (Phase 4) — every badge is computed live from the real `meals` array
 * App.tsx already loads from Supabase, via src/lib/achievements.ts. No invented progress number:
 * a locked badge shows the real current count against the real target (e.g. "4/7 days"), not a
 * decorative bar. See achievements.ts's own header comment for why this is fully client-computed
 * rather than backed by a new Supabase table/column.
 */
export function Achievements({ meals, goals, displayName }: { meals: Meal[]; goals: Goals; displayName?: string | null }) {
  const badges = useMemo(() => computeBadges(meals, goals), [meals, goals])
  const earnedCount = badges.filter((b) => b.earned).length
  const [sharingBadge, setSharingBadge] = useState<Badge | null>(null)

  // Fire a celebration exactly once per newly-earned badge (per device — see achievements.ts).
  // Runs after every real meals/goals change, not on every render, via the same dependency array.
  useEffect(() => {
    const newly = getNewlyEarnedBadges(badges)
    for (const badge of newly) {
      if (badge.celebration === 'streak') fireStreakConfetti()
      else if (badge.celebration === 'bullseye') fireBullseyeConfetti()
      else fireConfetti()
      hapticCelebrate()
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
          <BadgeCard
            key={badge.id}
            badge={badge}
            onShare={
              badge.earned
                ? () => {
                    hapticTap()
                    setSharingBadge(badge)
                  }
                : undefined
            }
          />
        ))}
      </div>

      {sharingBadge && (
        <MilestoneShareCard
          eyebrow="Achievement unlocked"
          headline={sharingBadge.title}
          bigNumber={sharingBadge.progressTarget}
          bigNumberLabel={sharingBadge.description}
          icon={sharingBadge.icon}
          accentColor="#00e5a0"
          name={displayName}
          onClose={() => setSharingBadge(null)}
        />
      )}
    </section>
  )
}

function BadgeCard({ badge, onShare }: { badge: Badge; onShare?: () => void }) {
  const pct = Math.min(100, (badge.progressCurrent / badge.progressTarget) * 100)
  return (
    <div
      onClick={onShare}
      role={onShare ? 'button' : undefined}
      className={cn(
        'glass-card relative flex flex-col items-center gap-1 p-3 text-center',
        badge.earned ? 'shadow-[0_0_16px_2px_var(--glow-health)]' : 'opacity-70',
        onShare && 'cursor-pointer active:scale-95',
      )}
    >
      {onShare && (
        <span className="absolute right-1.5 top-1.5 text-[11px] text-accent-health" aria-hidden>
          <Share2 size={12} />
        </span>
      )}
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
