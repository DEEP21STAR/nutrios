import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Goals, Meal } from '@/lib/types'
import { lastNDaysCalorieTotals, type DayVsGoal } from '@/lib/stats'
import { listMealsSince } from '@/lib/mealsRepo'
import { insertWeightLog, listWeightLogsSince, WeightTableMissingError, type WeightLog } from '@/lib/weightRepo'
import { cn } from '@/lib/utils'

const HISTORY_DAYS = 7

/**
 * Trends & History (Phase 5, 2026-09-17) — the highest-priority gap from the competitor
 * research (Cronometer's Energy History, fatsecret's weight-over-time chart, Lose It's "My
 * Analysis: on target" bar chart all converged on this). Appended as its own section at the
 * bottom of the existing single-scroll Today page, same pattern Phase 4 used for
 * Achievements/TogetherMode — a flagged placement call: this app has no tab/nav system at all,
 * and building one just for this screen felt like more surface area/risk than the brief asked
 * for. If Deep wants a dedicated Trends tab later, this section is already self-contained and
 * would lift out cleanly.
 *
 * Owns its OWN data fetch (real Supabase calls, not props from App.tsx's `meals`/today-only
 * state) — see mealsRepo.listMealsSince and weightRepo.listWeightLogsSince. This keeps every
 * existing Today-screen consumer (TodayRing, MealTimeline, Achievements, TogetherMode) exactly as
 * they were: still fed only today's meals, unchanged. Refetches whenever `userId` changes
 * (mount) — there's no live-subscription for the history window (only `meals` gets Realtime),
 * so a meal logged while this section is on-screen won't retroactively update its own bars until
 * the next reload. Small, honest gap, not fixed this pass — flagged in the phase report.
 */
export function TrendsHistory({ userId, goals }: { userId: string | null; goals: Goals }) {
  const [historyMeals, setHistoryMeals] = useState<Meal[] | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [weightLogs, setWeightLogs] = useState<WeightLog[] | null>(null)
  const [weightTableMissing, setWeightTableMissing] = useState(false)
  const [weightError, setWeightError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const since = new Date()
    since.setDate(since.getDate() - (HISTORY_DAYS - 1))
    since.setHours(0, 0, 0, 0)

    listMealsSince(userId, since.toISOString())
      .then((meals) => { if (!cancelled) setHistoryMeals(meals) })
      .catch((err) => { if (!cancelled) setHistoryError(err instanceof Error ? err.message : 'Failed to load history.') })

    listWeightLogsSince(userId, since.toISOString())
      .then((logs) => { if (!cancelled) setWeightLogs(logs) })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof WeightTableMissingError) setWeightTableMissing(true)
        else setWeightError(err instanceof Error ? err.message : 'Failed to load weight history.')
      })

    return () => { cancelled = true }
  }, [userId])

  const dayTotals = useMemo(() => lastNDaysCalorieTotals(historyMeals ?? [], goals, HISTORY_DAYS), [historyMeals, goals])

  return (
    <section className="mt-6 px-4">
      <h2 className="mb-2 text-subtitle text-text-primary">Trends & History</h2>

      <div className="glass-card p-3">
        <p className="mb-2 text-caption uppercase tracking-wide text-text-tertiary">
          Calories — last {HISTORY_DAYS} days vs. goal
        </p>
        {historyError ? (
          <p className="text-caption text-accent-danger">{historyError}</p>
        ) : historyMeals === null ? (
          <p className="text-caption text-text-tertiary">Loading…</p>
        ) : (
          <WeeklyCalorieChart data={dayTotals} />
        )}
      </div>

      <div className="glass-card mt-3 p-3">
        <p className="mb-2 text-caption uppercase tracking-wide text-text-tertiary">Weight trend</p>
        {weightTableMissing ? (
          <p className="text-caption text-text-tertiary">
            Weight logging isn't set up in the database yet — run{' '}
            <code className="text-text-secondary">supabase/migrations/0003_weight_log.sql</code> in the Supabase SQL
            Editor, then this card will let you log and chart your weight.
          </p>
        ) : weightError ? (
          <p className="text-caption text-accent-danger">{weightError}</p>
        ) : weightLogs === null ? (
          <p className="text-caption text-text-tertiary">Loading…</p>
        ) : weightLogs.length === 0 ? (
          <WeightLogEmptyState
            userId={userId}
            onLogged={(log) => setWeightLogs((prev) => [...(prev ?? []), log])}
          />
        ) : (
          <>
            <WeightTrendChart data={weightLogs} />
            <WeightLogInline
              userId={userId}
              onLogged={(log) => setWeightLogs((prev) => [...(prev ?? []), log])}
            />
          </>
        )}
      </div>
    </section>
  )
}

/**
 * Real recharts bar chart (recharts was already an installed-but-unused dependency —
 * package.json confirmed it before writing this, so this is the first thing in the codebase to
 * actually import it). One measure (calories), one axis — the goal is a ReferenceLine on the SAME
 * scale, not a second y-axis, per standard chart-design practice (a dual-axis chart invites
 * misreading two different scales as directly comparable). Bar colour is a status encoding
 * (health = at/under goal, danger = over) reusing this app's own existing accent tokens rather
 * than a generic chart palette, for visual consistency with TodayRing's identical colour logic.
 */
function WeeklyCalorieChart({ data }: { data: DayVsGoal[] }) {
  const goal = data[0]?.goal ?? 0
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="dayLabel" tick={{ fill: 'rgba(255,255,255,0.48)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.48)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            // Real bug found during live verification: a negative chart-level margin.left
            // (copied from a pattern elsewhere in this app) combined with a fixed axis width
            // pushed part of the axis off the SVG's left edge, silently clipping the LEADING
            // digits of any 4-digit calorie value (e.g. "2530" rendered as "30"). Fixed by
            // giving the axis real width instead of relying on a negative margin to fake it.
            width={46}
            // Real bug found during live verification: recharts' default auto-domain fits only
            // the BAR data, so on a mostly-empty week the goal ReferenceLine (drawn at the real
            // calorie goal, e.g. 2200) landed far above the visible axis range and never
            // rendered. Forcing the domain's top to cover the goal too keeps the goal line
            // visible even when every day this week is 0/under it.
            domain={[0, (dataMax: number) => Math.max(dataMax, goal) * 1.15]}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.06)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as DayVsGoal
              return (
                <div className="glass-card px-2 py-1.5 text-caption text-text-primary">
                  <p className="font-semibold">{d.dayLabel}</p>
                  <p>{d.hasData ? `${Math.round(d.calories)} kcal` : 'No meals logged'}</p>
                  <p className="text-text-tertiary">Goal: {d.goal} kcal</p>
                </div>
              )
            }}
          />
          <ReferenceLine y={goal} stroke="var(--color-accent-energy)" strokeDasharray="4 4" strokeWidth={1.5} />
          <Bar dataKey="calories" radius={[4, 4, 0, 0]} maxBarSize={28}>
            {data.map((d) => (
              <Cell
                key={d.date}
                fill={!d.hasData ? 'rgba(255,255,255,0.08)' : d.calories > d.goal ? 'var(--color-accent-danger)' : 'var(--color-accent-health)'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-caption text-text-tertiary">▬ Goal ({goal} kcal) · under goal in emerald, over in red</p>
    </div>
  )
}

/** Real recharts line chart over real logged weight entries — no fabricated points. */
function WeightTrendChart({ data }: { data: WeightLog[] }) {
  const chartData = data.map((d) => ({
    ...d,
    dateLabel: new Date(d.loggedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }),
  }))
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis dataKey="dateLabel" tick={{ fill: 'rgba(255,255,255,0.48)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'rgba(255,255,255,0.48)', fontSize: 11 }} axisLine={false} tickLine={false} width={46} domain={['auto', 'auto']} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              const d = payload[0].payload as { dateLabel: string; weightKg: number }
              return (
                <div className="glass-card px-2 py-1.5 text-caption text-text-primary">
                  <p className="font-semibold">{d.dateLabel}</p>
                  <p>{d.weightKg} kg</p>
                </div>
              )
            }}
          />
          <Line type="monotone" dataKey="weightKg" stroke="var(--color-accent-health)" strokeWidth={2} dot={{ r: 3, fill: 'var(--color-accent-health)' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

/** Shown when there are zero real weight entries yet — explicitly NOT a fake sample chart, per
 * the task's hard rule against fabricating data for empty states. */
function WeightLogEmptyState({ userId, onLogged }: { userId: string | null; onLogged: (log: WeightLog) => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-4 text-center">
      <p className="text-caption text-text-tertiary">No weight logged yet — log your weight to see your trend here.</p>
      <WeightLogForm userId={userId} onLogged={onLogged} />
    </div>
  )
}

/** Compact inline form shown under an already-populated chart, for logging the next entry. */
function WeightLogInline({ userId, onLogged }: { userId: string | null; onLogged: (log: WeightLog) => void }) {
  return (
    <div className="mt-2 border-t border-white/5 pt-2">
      <WeightLogForm userId={userId} onLogged={onLogged} />
    </div>
  )
}

function WeightLogForm({ userId, onLogged }: { userId: string | null; onLogged: (log: WeightLog) => void }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    const kg = Number(value)
    if (!userId || !Number.isFinite(kg) || kg <= 0) {
      setError('Enter a real weight in kg.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const log = await insertWeightLog(userId, kg)
      onLogged(log)
      setValue('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log weight.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min="1"
        placeholder="Weight (kg)"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-28 rounded-sm bg-bg-tertiary px-2 py-1.5 text-body text-text-primary outline-none ring-1 ring-white/5 focus:ring-accent-health"
      />
      <button
        onClick={submit}
        disabled={busy || !userId}
        className={cn(
          'glass rounded-full px-3 py-1.5 text-caption font-semibold text-accent-health transition active:scale-95',
          (busy || !userId) && 'opacity-50',
        )}
      >
        {busy ? 'Logging…' : 'Log weight'}
      </button>
      {error && <span className="text-caption text-accent-danger">{error}</span>}
    </div>
  )
}
