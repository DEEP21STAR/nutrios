import type { Meal } from '@/lib/types'
import { sumMacros } from '@/lib/types'

/** Meal timeline with real photo thumbnails — step 5 of the core loop. */
export function MealTimeline({ meals }: { meals: Meal[] }) {
  if (meals.length === 0) {
    return <p className="mt-8 text-center text-sm text-slate-500">No meals logged yet today.</p>
  }
  return (
    <ul className="mt-6 flex flex-col gap-3 px-4">
      {[...meals].reverse().map((meal) => {
        const totals = sumMacros(meal.items)
        const time = new Date(meal.loggedAt).toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })
        return (
          <li key={meal.id} className="flex items-center gap-3 rounded-xl bg-slate-800/60 p-2">
            <img src={meal.photoDataUrl} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-100">{meal.items.map((i) => i.name).join(', ') || 'Untitled meal'}</p>
              <p className="text-xs text-slate-400">
                {time} · {Math.round(totals.calories)} kcal
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
