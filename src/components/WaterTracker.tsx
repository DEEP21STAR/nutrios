import { useState } from 'react'
import { Droplet } from 'lucide-react'
import { addWaterMl, getTodayWaterMl, WATER_GOAL_ML } from '@/lib/waterTracking'
import { hapticTap } from '@/lib/haptics'

const WATER_COLOR = '#60a5fa'
const QUICK_ADD = [
  { label: 'Glass', ml: 250 },
  { label: 'Bottle', ml: 500 },
]

/** Today-tab water widget — free for everyone (see waterTracking.ts's own header comment for the
 * real competitive reasoning). Deliberately reads its own state via useState(getTodayWaterMl)
 * rather than a prop from App.tsx: this is genuinely local/daily state, not account data other
 * components need to share, so it doesn't need App.tsx threading it through. */
export function WaterTracker() {
  const [ml, setMl] = useState(getTodayWaterMl)
  const pct = Math.min(100, (ml / WATER_GOAL_ML) * 100)

  function handleAdd(amount: number) {
    hapticTap()
    setMl(addWaterMl(amount))
  }

  return (
    <div className="glass-card mx-4 mt-4 flex w-[calc(100%-2rem)] flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplet size={18} style={{ color: WATER_COLOR, filter: `drop-shadow(0 0 5px ${WATER_COLOR})` }} />
          <span className="text-body font-semibold">Water</span>
        </div>
        <span className="text-caption text-text-tertiary">
          {(ml / 1000).toFixed(1)}L / {(WATER_GOAL_ML / 1000).toFixed(1)}L
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, background: WATER_COLOR, boxShadow: `0 0 8px 1px ${WATER_COLOR}` }}
        />
      </div>

      <div className="flex gap-2">
        {QUICK_ADD.map((q) => (
          <button
            key={q.label}
            onClick={() => handleAdd(q.ml)}
            className="flex-1 rounded-xl border py-2 text-caption font-semibold transition active:scale-95"
            style={{ borderColor: `${WATER_COLOR}66`, backgroundColor: `${WATER_COLOR}1a`, color: WATER_COLOR }}
          >
            +{q.label} ({q.ml}ml)
          </button>
        ))}
      </div>
    </div>
  )
}
