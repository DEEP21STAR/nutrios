import { RadialProgress } from '@/components/RadialProgress'
import { CountUp } from '@/components/CountUp'
import type { MacroTotals, Goals } from '@/lib/types'

const MACRO_COLORS = { protein: '#f472b6', fat: '#fbbf24', carbs: '#60a5fa' } as const

/**
 * Today screen's calorie ring + 3 nested macro rings, reusing Clarity's real
 * RadialProgress (SVG stroke-dasharray/dashoffset, GSAP fill) and CountUp
 * (kinetic digit count-up) components verbatim rather than re-implementing
 * the same animation twice.
 */
export function TodayRing({ totals, goals }: { totals: MacroTotals; goals: Goals }) {
  const caloriePct = (totals.calories / goals.calorieGoal) * 100

  return (
    <div className="relative mx-auto" style={{ width: 260, height: 260 }}>
      <RadialProgress percent={caloriePct} color="#34d399" size={260} strokeWidth={16} />
      <div className="absolute" style={{ inset: 30 }}>
        <RadialProgress
          percent={(totals.proteinG / goals.proteinGoalG) * 100}
          color={MACRO_COLORS.protein}
          size={200}
          strokeWidth={10}
        />
      </div>
      <div className="absolute" style={{ inset: 56 }}>
        <RadialProgress
          percent={(totals.fatG / goals.fatGoalG) * 100}
          color={MACRO_COLORS.fat}
          size={148}
          strokeWidth={9}
        />
      </div>
      <div className="absolute" style={{ inset: 80 }}>
        <RadialProgress
          percent={(totals.carbsG / goals.carbsGoalG) * 100}
          color={MACRO_COLORS.carbs}
          size={100}
          strokeWidth={8}
        />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <CountUp value={totals.calories} decimals={0} className="text-3xl font-bold text-slate-50" />
        <span className="text-xs text-slate-400">of {goals.calorieGoal} kcal</span>
      </div>
    </div>
  )
}
