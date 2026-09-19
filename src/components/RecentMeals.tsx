import { useEffect, useRef, useState } from 'react'
import { Repeat } from 'lucide-react'
import type { FoodItem, Meal } from '@/lib/types'
import { sumMacros } from '@/lib/types'
import { listMealsSince } from '@/lib/mealsRepo'
import { hapticTap } from '@/lib/haptics'

const HISTORY_DAYS = 30
const LONG_PRESS_MS = 450

interface MealGroup {
  key: string
  label: string
  items: FoodItem[]
  calories: number
  count: number
  lastLoggedAt: string
}

/** Groups meals by a normalized name (trimmed items joined, lowercased) so "Banana" logged twice
 * counts as the same real repeat rather than two unrelated one-off entries. */
function groupMeals(meals: Meal[]): MealGroup[] {
  const groups = new Map<string, MealGroup>()
  for (const meal of meals) {
    const label = meal.items.map((i) => i.name.trim()).filter(Boolean).join(', ')
    if (!label) continue
    const key = label.toLowerCase()
    const existing = groups.get(key)
    if (!existing || meal.loggedAt > existing.lastLoggedAt) {
      groups.set(key, {
        key,
        label,
        items: meal.items,
        calories: sumMacros(meal.items).calories,
        count: (existing?.count ?? 0) + 1,
        lastLoggedAt: meal.loggedAt,
      })
    } else {
      existing.count += 1
    }
  }
  return [...groups.values()]
}

/**
 * Today-tab quick re-log — the highest-leverage remaining "effortless" win: nobody eats a
 * completely different meal every day, but every log before this was a fresh camera/voice/
 * barcode flow even for something eaten yesterday. Tap = genuinely one-tap re-log (no confirm
 * screen -- see App.tsx's handleQuickLog). Long-press = opens the confirm screen pre-filled
 * instead, for when the portion/items actually need adjusting this time.
 *
 * Owns its own 30-day history fetch (same self-contained pattern as StreakBanner/TrendsHistory --
 * App.tsx's own `meals` prop is deliberately today-only, learned the hard way once already this
 * session when StreakBanner was first wired to it by mistake).
 */
export function RecentMeals({
  userId,
  todaysMealCount,
  onQuickLog,
  onRepeatForEdit,
}: {
  userId: string | null
  todaysMealCount: number
  onQuickLog: (items: FoodItem[]) => void
  onRepeatForEdit: (items: FoodItem[]) => void
}) {
  const [history, setHistory] = useState<Meal[] | null>(null)
  const pressTimer = useRef<number | null>(null)
  const longPressed = useRef(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const since = new Date()
    since.setDate(since.getDate() - HISTORY_DAYS)
    listMealsSince(userId, since.toISOString())
      .then((meals) => { if (!cancelled) setHistory(meals) })
      .catch(() => { if (!cancelled) setHistory([]) })
    return () => { cancelled = true }
    // Re-fetch whenever a new meal is logged so a just-eaten meal can show up as "Recent" without
    // waiting for a full remount.
  }, [userId, todaysMealCount])

  if (!history || history.length === 0) return null

  const groups = groupMeals(history).sort((a, b) => b.lastLoggedAt.localeCompare(a.lastLoggedAt))
  const frequent = groups.filter((g) => g.count >= 2).sort((a, b) => b.count - a.count).slice(0, 6)
  const recent = groups.slice(0, 8)

  if (frequent.length === 0 && recent.length === 0) return null

  function startPress(group: MealGroup) {
    longPressed.current = false
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true
      hapticTap()
      onRepeatForEdit(group.items)
    }, LONG_PRESS_MS)
  }
  function endPress(group: MealGroup) {
    if (pressTimer.current) clearTimeout(pressTimer.current)
    if (!longPressed.current) {
      hapticTap()
      onQuickLog(group.items)
    }
  }
  function cancelPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current)
  }

  function Row({ title, groups: rowGroups }: { title: string; groups: MealGroup[] }) {
    if (rowGroups.length === 0) return null
    return (
      <div className="flex flex-col gap-2">
        <p className="text-caption uppercase tracking-wide text-text-tertiary">{title}</p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {rowGroups.map((g) => (
            <button
              key={g.key}
              onMouseDown={() => startPress(g)}
              onMouseUp={() => endPress(g)}
              onMouseLeave={cancelPress}
              onTouchStart={() => startPress(g)}
              onTouchEnd={() => endPress(g)}
              className="glass flex shrink-0 flex-col items-start gap-0.5 rounded-xl px-3 py-2 text-left transition active:scale-95"
            >
              <span className="max-w-32 truncate text-caption font-medium text-text-primary">{g.label}</span>
              <span className="text-[11px] text-accent-health">{Math.round(g.calories)} kcal</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card mx-4 mt-4 flex w-[calc(100%-2rem)] flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <Repeat size={16} className="text-accent-health" />
        <span className="text-body font-semibold">Quick log</span>
        <span className="text-caption text-text-tertiary">tap to repeat · hold to edit</span>
      </div>
      <Row title="Frequent" groups={frequent} />
      <Row title="Recent" groups={recent} />
    </div>
  )
}
