import type { Meal } from '@/lib/types'
import { sumMacros } from '@/lib/types'

/** Timeline View — restyled to the glass system (visual layer only, same data/order/logic as before). */
export function MealTimeline({ meals }: { meals: Meal[] }) {
  if (meals.length === 0) {
    return <p className="mt-8 text-center text-body text-text-tertiary">No meals logged yet today.</p>
  }
  return (
    <ul className="relative mt-6 flex flex-col gap-3 px-4">
      {[...meals].reverse().map((meal) => {
        const totals = sumMacros(meal.items)
        const loggedAt = new Date(meal.loggedAt)
        // Full date + time (Phase 3 item 4) — loggedAt was already a full ISO timestamp end to
        // end (App.tsx/ConfirmLog write it, Postgres stores it as timestamptz), this component
        // was just formatting away the date part. Today's entries still read as time-only (that's
        // the common case and matches the existing Today-screen framing); anything from an
        // earlier day now shows its date too, so a meal from yesterday doesn't silently look like
        // it happened at "8:14 PM" today.
        const isToday = loggedAt.toDateString() === new Date().toDateString()
        const time = loggedAt.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' })
        const dateTime = isToday
          ? time
          : `${loggedAt.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}, ${time}`
        return (
          <li key={meal.id} className="glass-card flex items-center gap-3 p-2">
            {meal.photoDataUrl ? (
              <img src={meal.photoDataUrl} alt="" className="h-14 w-14 shrink-0 rounded-sm object-cover" />
            ) : (
              // Voice-logged meal — no photo. Same violet AI-glow treatment
              // used everywhere else a voice-originated meal has no image.
              <div
                className="grid h-14 w-14 shrink-0 place-items-center rounded-sm bg-bg-tertiary text-lg text-accent-ai"
                aria-hidden
              >
                🎙️
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-body text-text-primary">{meal.items.map((i) => i.name).join(', ') || 'Untitled meal'}</p>
              <p className="text-caption text-text-tertiary">
                {dateTime} · <span className="text-data text-accent-health">{Math.round(totals.calories)} kcal</span>
              </p>
              {/* Eating Out tag (Phase 3 item 3/4) — glass "windowed" chip in the same amber
                  (accent-energy) used for the ConfirmLog toggle, so the two agree visually. */}
              {meal.isEatingOut && (
                <p className="mt-0.5 truncate text-caption text-accent-energy">
                  🍽️ Eating out{meal.restaurantName ? ` · ${meal.restaurantName}` : ''}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
