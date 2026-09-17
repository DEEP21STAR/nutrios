import { RadialProgress } from '@/components/RadialProgress'
import { CountUp } from '@/components/CountUp'
import type { MacroTotals, Goals } from '@/lib/types'

export const MACRO_COLORS = { protein: '#f472b6', fat: '#fbbf24', carbs: '#60a5fa' } as const

/**
 * Low-remaining threshold judgment call (the spec calls for "amber/crimson
 * glow shifts at low-remaining thresholds" but doesn't hand over exact
 * numbers) — remaining budget is amber under 25% of goal left, crimson
 * under 10% left or already over. Otherwise the ring stays Luminous
 * Emerald, the spec's health/success colour.
 */
export function ringColorForRemaining(remainingPct: number): string {
  if (remainingPct <= 10) return 'var(--color-accent-danger)'
  if (remainingPct <= 25) return 'var(--color-accent-energy)'
  return 'var(--color-accent-health)'
}

/**
 * NUTRIOS Dashboard Fluid Ring — Today screen's calorie ring + 3 nested
 * macro rings. Restyled visual layer only: same RadialProgress (SVG
 * stroke-dasharray/dashoffset, now GSAP elastic-fill) and CountUp (kinetic
 * digit count-up) components, same totals/goals data model.
 */
export function TodayRing({ totals, goals }: { totals: MacroTotals; goals: Goals }) {
  const caloriePct = (totals.calories / goals.calorieGoal) * 100
  const remaining = Math.max(0, goals.calorieGoal - totals.calories)
  const remainingPct = (remaining / goals.calorieGoal) * 100
  const ringColor = ringColorForRemaining(remainingPct)

  return (
    <div className="relative mx-auto mt-2" style={{ width: 260, height: 260 }}>
      <RadialProgress percent={caloriePct} color={ringColor} size={260} strokeWidth={16} />
      <div className="absolute" style={{ inset: 30 }}>
        <RadialProgress
          percent={(totals.proteinG / goals.proteinGoalG) * 100}
          color={MACRO_COLORS.protein}
          size={200}
          strokeWidth={10}
          glow={false}
        />
      </div>
      <div className="absolute" style={{ inset: 56 }}>
        <RadialProgress
          percent={(totals.fatG / goals.fatGoalG) * 100}
          color={MACRO_COLORS.fat}
          size={148}
          strokeWidth={9}
          glow={false}
        />
      </div>
      <div className="absolute" style={{ inset: 80 }}>
        <RadialProgress
          percent={(totals.carbsG / goals.carbsGoalG) * 100}
          color={MACRO_COLORS.carbs}
          size={100}
          strokeWidth={8}
          glow={false}
        />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp value={totals.calories} decimals={0} className="text-display text-text-primary" />
        <span className="text-caption text-text-tertiary">of {goals.calorieGoal} kcal</span>
        <span className="text-caption mt-1" style={{ color: ringColor }}>
          {Math.round(remaining)} kcal left
        </span>
      </div>
    </div>
  )
}
