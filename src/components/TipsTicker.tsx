import { useEffect, useMemo, useState } from 'react'
import type { Goals, Meal } from '@/lib/types'
import { generateTips, type Tip } from '@/lib/tips'
import { prefersReducedMotion } from '@/lib/utils'

/**
 * Tips ticker (Phase 4, Together Mode) — horizontally-scrolling row of short rotating tips.
 * Personalized tips (computed from real logged data, e.g. "You've logged 5 days in a row") lead
 * the list when there's enough real history; generic nutrition/feature tips fill the rest so a
 * brand-new user never sees an empty ticker. See src/lib/tips.ts for the actual computation.
 *
 * Right-to-left continuous scroll is intentional here — per project memory, this is genuinely
 * low-stakes ambient content, distinct from the earlier decision NOT to auto-scroll actionable
 * notifications elsewhere in this app. `prefers-reduced-motion` is still respected: this
 * component renders an entirely different, non-animated tap-through control when that preference
 * is set, checked both at the JS level (this file, via prefersReducedMotion()) and independently
 * at the CSS level (.animate-tips-scroll's own @media guard in index.css).
 */
export function TipsTicker({ meals, goals }: { meals: Meal[]; goals: Goals }) {
  const tips = useMemo(() => generateTips(meals, goals), [meals, goals])
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const handler = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  if (tips.length === 0) return null

  return (
    <div className="mt-6 px-0" aria-label="Tips">
      {reducedMotion ? <StaticTipsRotator tips={tips} /> : <ScrollingTips tips={tips} />}
    </div>
  )
}

function TipChip({ tip }: { tip: Tip }) {
  return (
    <div
      className="glass-card flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 text-caption text-text-secondary"
      title={tip.kind === 'personalized' ? 'Based on your logged meals' : undefined}
    >
      <span aria-hidden>{tip.icon}</span>
      <span>{tip.text}</span>
    </div>
  )
}

function ScrollingTips({ tips }: { tips: Tip[] }) {
  return (
    <div className="overflow-hidden">
      {/* Content duplicated back-to-back so the -50% translateX loop has no visible seam. */}
      <div className="flex w-max animate-tips-scroll gap-3 px-4">
        {[...tips, ...tips].map((tip, i) => (
          <TipChip key={`${tip.id}-${i}`} tip={tip} />
        ))}
      </div>
    </div>
  )
}

/**
 * Reduced-motion fallback: no auto-advance, no transform animation at all — just the current tip
 * plus manual Back/Next controls the user drives themselves. Text swaps instantly (no fade/slide)
 * so nothing here reads as "motion" under the preference this branch exists to respect.
 */
function StaticTipsRotator({ tips }: { tips: Tip[] }) {
  const [index, setIndex] = useState(0)
  const tip = tips[index % tips.length]
  return (
    <div className="mx-4 flex items-center gap-2">
      <button
        onClick={() => setIndex((i) => (i - 1 + tips.length) % tips.length)}
        aria-label="Previous tip"
        className="glass grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-tertiary"
      >
        ‹
      </button>
      <div className="glass-card min-w-0 flex-1 px-4 py-2 text-caption text-text-secondary">
        <span aria-hidden>{tip.icon}</span> {tip.text}
      </div>
      <button
        onClick={() => setIndex((i) => (i + 1) % tips.length)}
        aria-label="Next tip"
        className="glass grid h-8 w-8 shrink-0 place-items-center rounded-full text-text-tertiary"
      >
        ›
      </button>
    </div>
  )
}
