import { useEffect, useState } from 'react'
import { Flame, Share2 } from 'lucide-react'
import { WORKOUT_TYPES, estimateCaloriesBurned } from '@/lib/workouts'
import { insertWorkout, listTodayWorkouts, WorkoutTableMissingError, type WorkoutLog } from '@/lib/workoutsRepo'
import { listWeightLogsSince } from '@/lib/weightRepo'
import { hapticCelebrate, hapticTap } from '@/lib/haptics'
import { fireStreakConfetti } from '@/lib/confetti'
import { MilestoneShareCard } from '@/components/MilestoneShareCard'

const WORKOUT_COLOR = '#fb7185'

/**
 * Light workout tracking (2026-09-19) -- the deliberately-scoped version of "add a workout
 * section" (see workouts.ts's own header comment for the real product-scope reasoning). Owns its
 * own today-only fetch, same self-contained pattern as StreakBanner/WaterTracker.
 */
export function WorkoutTracker({
  userId,
  onBurnedChange,
  displayName,
}: {
  userId: string | null
  onBurnedChange?: (kcal: number) => void
  displayName?: string | null
}) {
  const [workouts, setWorkouts] = useState<WorkoutLog[] | null>(null)
  const [tableMissing, setTableMissing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [sharingWorkout, setSharingWorkout] = useState<WorkoutLog | null>(null)

  async function refresh() {
    if (!userId) return
    try {
      const list = await listTodayWorkouts(userId)
      setWorkouts(list)
      onBurnedChange?.(list.reduce((sum, w) => sum + w.caloriesBurned, 0))
    } catch (err) {
      if (err instanceof WorkoutTableMissingError) setTableMissing(true)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh is stable enough for this purpose, re-run only on userId change
  }, [userId])

  if (tableMissing) {
    return (
      <div className="glass-card mx-4 mt-4 flex w-[calc(100%-2rem)] flex-col gap-1 p-4">
        <p className="text-caption text-text-tertiary">
          Workout logging isn't set up in the database yet — run{' '}
          <code className="text-text-secondary">supabase/migrations/0008_workout_logs.sql</code> in the Supabase SQL
          Editor, then this card will let you log workouts.
        </p>
      </div>
    )
  }

  const totalBurned = (workouts ?? []).reduce((sum, w) => sum + w.caloriesBurned, 0)

  return (
    <>
      <div className="glass-card mx-4 mt-4 flex w-[calc(100%-2rem)] flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame size={18} style={{ color: WORKOUT_COLOR, filter: `drop-shadow(0 0 5px ${WORKOUT_COLOR})` }} />
            <span className="text-body font-semibold">Workouts</span>
          </div>
          <span className="text-caption text-text-tertiary">{totalBurned > 0 ? `${totalBurned} kcal burned` : 'None today'}</span>
        </div>

        {workouts && workouts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {workouts.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-caption">
                <span className="text-text-secondary">
                  {WORKOUT_TYPES.find((t) => t.id === w.workoutType)?.label ?? w.workoutType} · {w.durationMin} min
                </span>
                <span className="flex items-center gap-2">
                  <span style={{ color: WORKOUT_COLOR }}>{w.caloriesBurned} kcal</span>
                  <button
                    onClick={() => {
                      hapticTap()
                      setSharingWorkout(w)
                    }}
                    aria-label="Share workout"
                    style={{ color: WORKOUT_COLOR }}
                  >
                    <Share2 size={13} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            hapticTap()
            setShowForm(true)
          }}
          className="rounded-xl border py-2.5 text-caption font-semibold transition active:scale-95"
          style={{ borderColor: `${WORKOUT_COLOR}66`, backgroundColor: `${WORKOUT_COLOR}1a`, color: WORKOUT_COLOR }}
        >
          + Log a workout
        </button>
      </div>

      {showForm && userId && (
        <WorkoutForm
          userId={userId}
          onClose={() => setShowForm(false)}
          onLogged={() => {
            setShowForm(false)
            refresh()
          }}
        />
      )}

      {sharingWorkout && (
        <MilestoneShareCard
          eyebrow={WORKOUT_TYPES.find((t) => t.id === sharingWorkout.workoutType)?.label ?? sharingWorkout.workoutType}
          headline={`${sharingWorkout.durationMin} minute workout`}
          bigNumber={sharingWorkout.caloriesBurned}
          bigNumberLabel="kcal burned"
          icon="🔥"
          accentColor={WORKOUT_COLOR}
          name={displayName}
          onClose={() => setSharingWorkout(null)}
        />
      )}
    </>
  )
}

function WorkoutForm({ userId, onClose, onLogged }: { userId: string; onClose: () => void; onLogged: () => void }) {
  const [typeId, setTypeId] = useState(WORKOUT_TYPES[0].id)
  const [duration, setDuration] = useState('30')
  const [weight, setWeight] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Pre-fill from the most recent real weight log if one exists -- convenient default, still
    // fully editable (same "editable confirm step is the real safety net" standard as everywhere
    // else in this app), not a hidden assumption.
    const since = new Date(0)
    listWeightLogsSince(userId, since.toISOString())
      .then((logs) => {
        if (logs.length > 0) setWeight(String(logs[logs.length - 1].weightKg))
      })
      .catch(() => {
        // Weight table missing/empty -- leave the field blank, user types it in.
      })
  }, [userId])

  const type = WORKOUT_TYPES.find((t) => t.id === typeId)!
  const durationNum = parseFloat(duration)
  const weightNum = parseFloat(weight)
  const estimatedBurn =
    Number.isFinite(durationNum) && durationNum > 0 && Number.isFinite(weightNum) && weightNum > 0
      ? estimateCaloriesBurned(type.met, weightNum, durationNum)
      : null

  async function handleLog() {
    if (estimatedBurn === null) return
    setSaving(true)
    setError(null)
    try {
      await insertWorkout(userId, typeId, durationNum, estimatedBurn)
      hapticCelebrate()
      fireStreakConfetti()
      onLogged()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log workout.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg-primary">
      <div className="glass flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3">
        <button onClick={onClose} className="text-caption text-text-tertiary">
          Cancel
        </button>
        <h2 className="text-caption uppercase tracking-wide text-text-secondary">Log a Workout</h2>
        <div className="w-12" />
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5">
        <div>
          <p className="mb-2 text-caption text-text-tertiary">Type</p>
          <div className="grid grid-cols-2 gap-2">
            {WORKOUT_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTypeId(t.id)}
                className={`rounded-xl border px-3 py-2.5 text-left text-caption transition ${
                  typeId === t.id
                    ? 'border-accent-health bg-accent-health/10 text-text-primary'
                    : 'border-white/10 bg-bg-secondary text-text-secondary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-caption text-text-tertiary">Duration (minutes)</p>
          <input
            type="number"
            inputMode="numeric"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-bg-secondary px-4 py-3 text-body text-text-primary outline-none focus:border-accent-health"
          />
        </div>

        <div>
          <p className="mb-1.5 text-caption text-text-tertiary">Your weight (kg) — used for the calorie estimate</p>
          <input
            type="number"
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="e.g. 75"
            className="w-full rounded-xl border border-white/10 bg-bg-secondary px-4 py-3 text-body text-text-primary outline-none focus:border-accent-health placeholder:text-text-tertiary"
          />
        </div>

        <div className="glass-card flex items-center justify-between p-4">
          <span className="text-caption text-text-tertiary">Estimated burn</span>
          <span className="text-title text-accent-health">{estimatedBurn !== null ? `${estimatedBurn} kcal` : '—'}</span>
        </div>

        {error && <p className="text-caption text-accent-danger">{error}</p>}

        <button
          onClick={handleLog}
          disabled={estimatedBurn === null || saving}
          className="mt-auto rounded-full bg-accent-health py-3 text-subtitle font-semibold text-bg-primary shadow-[0_0_28px_6px_var(--glow-health)] transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
        >
          {saving ? 'Logging…' : 'Log workout'}
        </button>
      </div>
    </div>
  )
}

