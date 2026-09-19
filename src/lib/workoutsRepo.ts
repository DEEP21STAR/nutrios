import { supabase } from '@/lib/supabase'

/**
 * Real Supabase-backed workout log — same pattern as weightRepo.ts (WeightTableMissingError etc.)
 * since this is the same "new table, needs a one-time manual migration" situation. Backs the
 * calorie-burn adjustment on TodayRing and the workout-streak achievement.
 */
export interface WorkoutLog {
  id: string
  workoutType: string
  durationMin: number
  caloriesBurned: number
  loggedAt: string
}

interface WorkoutLogRow {
  id: string
  user_id: string
  workout_type: string
  duration_min: number
  calories_burned: number
  logged_at: string
}

function rowToWorkoutLog(row: WorkoutLogRow): WorkoutLog {
  return {
    id: row.id,
    workoutType: row.workout_type,
    durationMin: row.duration_min,
    caloriesBurned: row.calories_burned,
    loggedAt: row.logged_at,
  }
}

export class WorkoutTableMissingError extends Error {
  constructor() {
    super('workout_logs table not found — run supabase/migrations/0008_workout_logs.sql in the Supabase SQL Editor.')
    this.name = 'WorkoutTableMissingError'
  }
}

/** Same broad PGRST205/42P01/"could not find the table" signature as weightRepo.ts's own
 * isMissingWeightTableError — a missing *table*, not any other real error. */
function isMissingWorkoutTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /could not find the table/i.test(error.message ?? '') ||
    /relation .*workout_logs.* does not exist/i.test(error.message ?? '')
  )
}

export async function insertWorkout(
  userId: string,
  workoutType: string,
  durationMin: number,
  caloriesBurned: number,
): Promise<WorkoutLog> {
  const { data, error } = await supabase
    .from('workout_logs')
    .insert({ user_id: userId, workout_type: workoutType, duration_min: durationMin, calories_burned: caloriesBurned })
    .select()
    .single<WorkoutLogRow>()

  if (isMissingWorkoutTableError(error)) throw new WorkoutTableMissingError()
  if (error || !data) throw new Error(`Failed to log workout: ${error?.message ?? 'no row returned'}`)
  return rowToWorkoutLog(data)
}

/** All of today's workouts, for the calorie-burn adjustment on TodayRing. */
export async function listTodayWorkouts(userId: string): Promise<WorkoutLog[]> {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('workout_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', startOfDay.toISOString())
    .order('logged_at', { ascending: true })
    .returns<WorkoutLogRow[]>()

  if (isMissingWorkoutTableError(error)) throw new WorkoutTableMissingError()
  if (error) throw new Error(`Failed to load workouts: ${error.message}`)
  return (data ?? []).map(rowToWorkoutLog)
}
