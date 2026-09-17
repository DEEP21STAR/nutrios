import { useState } from 'react'
import { RadialProgress } from '@/components/RadialProgress'
import { CountUp } from '@/components/CountUp'
import { computeHealthyScore } from '@/lib/stats'
import type { Goals, MacroTotals, Meal } from '@/lib/types'

/**
 * Healthy Score (Phase 5, 2026-09-17) — single 0-100 composite gauge, added ALONGSIDE the
 * existing TodayRing rather than replacing any part of it (a deliberate, flagged placement call —
 * see this phase's handback report: TodayRing is already shipped/verified, and this is additive,
 * not a rewrite). See lib/stats.ts's computeHealthyScore for the full formula + why each weight
 * was chosen — this component only renders the number, it owns none of the math.
 */
function scoreColor(score: number): string {
  if (score >= 80) return 'var(--color-accent-health)'
  if (score >= 50) return 'var(--color-accent-energy)'
  return 'var(--color-accent-danger)'
}

export function HealthyScoreGauge({ totals, goals, todaysMeals }: { totals: MacroTotals; goals: Goals; todaysMeals: Meal[] }) {
  const [expanded, setExpanded] = useState(false)
  const breakdown = computeHealthyScore(totals, goals, todaysMeals)
  const color = scoreColor(breakdown.score)

  return (
    <button
      onClick={() => setExpanded((v) => !v)}
      className="glass-card mx-4 mt-4 flex w-[calc(100%-2rem)] flex-col items-stretch gap-2 p-3 text-left"
      aria-expanded={expanded}
    >
      <div className="flex items-center gap-3">
        <RadialProgress
          percent={breakdown.score}
          color={color}
          size={56}
          strokeWidth={6}
          glow={false}
          centerLabel={<CountUp value={breakdown.score} decimals={0} className="text-data text-text-primary" />}
        />
        <div className="min-w-0 flex-1">
          <p className="text-body font-semibold text-text-primary">Healthy Score</p>
          <p className="text-caption text-text-tertiary">
            {breakdown.score >= 80 ? 'On track today' : breakdown.score >= 50 ? 'Room to improve' : 'Off track today'} ·
            tap for breakdown
          </p>
        </div>
        <span className="shrink-0 text-caption text-text-tertiary" aria-hidden>
          {expanded ? '▲' : '▼'}
        </span>
      </div>

      {expanded && (
        <div className="flex flex-col gap-2 border-t border-white/5 pt-2">
          <ScoreBar label="Calorie goal" value={breakdown.calorieScore} max={40} />
          <ScoreBar label="Macro balance" value={breakdown.macroScore} max={30} />
          <ScoreBar label="Variety" value={breakdown.varietyScore} max={30} />
          <p className="mt-1 text-caption text-text-tertiary">
            A weighted mix of how close you are to your calorie goal, how balanced your protein/fat/carbs are
            against their own goals, and how many distinct foods you've logged today. Not a medical score.
          </p>
        </div>
      )}
    </button>
  )
}

function ScoreBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-caption text-text-secondary">
        <span>{label}</span>
        <span className="text-data">
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-tertiary">
        <div className="h-full rounded-full bg-accent-ai transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
