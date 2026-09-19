/**
 * Light workout tracking — real MET-based calorie burn, not a guess. The deliberately-scoped
 * version of "add a workout section": a real exercise-set/progressive-overload tracker (Strong/
 * Hevy/Jefit territory) is a genuinely separate product initiative, not a bolt-on -- this instead
 * matches how MyFitnessPal's own Exercise tab works: log a type + duration, get a real calorie
 * burn, feed it back into the day's calorie budget.
 *
 * MET values are the real academic standard (Compendium of Physical Activities, Ainsworth et al.)
 * -- verified the formula and general value ranges via research before writing this, not invented.
 * calories = MET x weight(kg) x duration(hours).
 */

export interface WorkoutType {
  id: string
  label: string
  met: number
}

export const WORKOUT_TYPES: WorkoutType[] = [
  { id: 'walking', label: 'Walking', met: 3.5 },
  { id: 'brisk-walking', label: 'Brisk walking', met: 4.3 },
  { id: 'running-moderate', label: 'Running (moderate)', met: 8.3 },
  { id: 'running-fast', label: 'Running (fast)', met: 11.8 },
  { id: 'cycling-moderate', label: 'Cycling (moderate)', met: 8.0 },
  { id: 'cycling-vigorous', label: 'Cycling (vigorous)', met: 10.0 },
  { id: 'swimming', label: 'Swimming', met: 6.0 },
  { id: 'weight-training', label: 'Weight training', met: 5.0 },
  { id: 'hiit', label: 'HIIT', met: 8.0 },
  { id: 'yoga', label: 'Yoga', met: 2.5 },
  { id: 'pilates', label: 'Pilates', met: 3.0 },
  { id: 'elliptical', label: 'Elliptical', met: 5.0 },
  { id: 'rowing', label: 'Rowing machine', met: 7.0 },
  { id: 'hiking', label: 'Hiking', met: 6.0 },
  { id: 'basketball', label: 'Basketball', met: 6.5 },
  { id: 'dancing', label: 'Dancing', met: 4.8 },
]

/** calories = MET x weight(kg) x duration(hours) — the real Compendium formula. */
export function estimateCaloriesBurned(met: number, weightKg: number, durationMin: number): number {
  return Math.round(met * weightKg * (durationMin / 60))
}
