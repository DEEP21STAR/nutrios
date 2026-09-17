import { RadialProgress } from '@/components/RadialProgress'
import { MACRO_COLORS, ringColorForRemaining } from '@/components/TodayRing'
import type { Goals, MacroTotals } from '@/lib/types'

/**
 * ConfirmLog's missing piece, per Deep: after a photo/voice/menu capture,
 * there was no answer to "how does THIS meal land against today's goals" —
 * only per-item macro numbers and a flat total. This sits between the item
 * list and the sticky footer, live-updating as portions/macros are edited
 * above (it's fed `mealTotals`, not a snapshot), and answers exactly that:
 * projected end-of-day position for calories/protein/fat/carbs, plus this
 * meal's own share of each, all four in the same ring language as the main
 * Today screen (RadialProgress, MACRO_COLORS, ringColorForRemaining) so it
 * reads as one continuous product, not a bolted-on extra screen.
 */
export function GoalImpact({
  todaysTotals,
  mealTotals,
  goals,
}: {
  /** Today's totals from meals already logged, BEFORE this one. */
  todaysTotals: MacroTotals
  /** This in-progress meal's totals — recomputed live by ConfirmLog as items/portions change. */
  mealTotals: MacroTotals
  goals: Goals
}) {
  const rows: Array<{
    key: keyof MacroTotals
    label: string
    unit: string
    goal: number
    color: string
  }> = [
    { key: 'calories', label: 'Kcal', unit: '', goal: goals.calorieGoal, color: 'var(--color-accent-health)' },
    { key: 'proteinG', label: 'Protein', unit: 'g', goal: goals.proteinGoalG, color: MACRO_COLORS.protein },
    { key: 'fatG', label: 'Fat', unit: 'g', goal: goals.fatGoalG, color: MACRO_COLORS.fat },
    { key: 'carbsG', label: 'Carbs', unit: 'g', goal: goals.carbsGoalG, color: MACRO_COLORS.carbs },
  ]

  const projectedCalories = todaysTotals.calories + mealTotals.calories
  const overGoal = projectedCalories > goals.calorieGoal
  const projectedPct = (projectedCalories / goals.calorieGoal) * 100
  const remainingAfter = Math.max(0, goals.calorieGoal - projectedCalories)
  const remainingAfterPct = (remainingAfter / goals.calorieGoal) * 100

  return (
    <div className="glass-card mx-4 mt-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-caption uppercase tracking-wide text-text-tertiary">This meal vs. today's goals</span>
        {overGoal && (
          <span className="rounded-full bg-accent-danger/15 px-2 py-0.5 text-caption text-accent-danger">
            Over goal
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {rows.map((row) => {
          const before = todaysTotals[row.key]
          const delta = mealTotals[row.key]
          const projected = before + delta
          const pct = row.goal > 0 ? (projected / row.goal) * 100 : 0
          const ringColor = row.key === 'calories' ? ringColorForRemaining(remainingAfterPct) : row.color

          return (
            <div key={row.key} className="flex flex-col items-center gap-1.5">
              <RadialProgress
                percent={pct}
                color={ringColor}
                size={62}
                strokeWidth={6}
                glow={false}
                centerLabel={
                  <span className="text-caption font-semibold" style={{ color: ringColor }}>
                    {Math.round(Math.min(999, pct))}%
                  </span>
                }
              />
              <span className="text-caption text-text-tertiary">{row.label}</span>
              <span className="text-caption font-medium" style={{ color: row.color }}>
                +{Math.round(delta)}
                {row.unit}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-3 border-t border-white/5 pt-3 text-center">
        <span className="text-caption text-text-secondary">
          After this meal: <span className="text-text-primary">{Math.round(projectedCalories)}</span> /{' '}
          {goals.calorieGoal} kcal ({Math.round(projectedPct)}%)
        </span>
        {overGoal ? (
          <p className="mt-0.5 text-caption text-accent-danger">
            {Math.round(projectedCalories - goals.calorieGoal)} kcal over today's goal
          </p>
        ) : (
          <p className="mt-0.5 text-caption text-accent-health">{Math.round(remainingAfter)} kcal left for today</p>
        )}
      </div>
    </div>
  )
}
