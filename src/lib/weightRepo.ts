import { supabase } from '@/lib/supabase'

/**
 * Real Supabase-backed weight log (Phase 5, Trends & History, 2026-09-17) — same real-project,
 * no-mock-data discipline as mealsRepo.ts. Backs the weight trend line chart in
 * TrendsHistory.tsx. Row shape matches supabase/migrations/0003_weight_log.sql's `weight_logs`
 * table, which — like 0001/0002 before it — needs a one-time manual run in the Supabase SQL
 * Editor before any of this actually persists (see that file's header comment).
 */
export interface WeightLog {
  id: string
  weightKg: number
  loggedAt: string // ISO timestamp
}

interface WeightLogRow {
  id: string
  user_id: string
  weight_kg: number
  logged_at: string
}

function rowToWeightLog(row: WeightLogRow): WeightLog {
  return { id: row.id, weightKg: row.weight_kg, loggedAt: row.logged_at }
}

/**
 * Thrown instead of a generic Error when the failure is specifically "the `weight_logs` table
 * doesn't exist yet" — i.e. 0003_weight_log.sql hasn't been run in the Supabase SQL Editor.
 * TrendsHistory.tsx catches this specific type and shows a plain-language "run this migration"
 * notice instead of a raw error string or (worse) a fabricated empty-looking chart that hides the
 * real cause.
 */
export class WeightTableMissingError extends Error {
  constructor() {
    super('weight_logs table not found — run supabase/migrations/0003_weight_log.sql in the Supabase SQL Editor.')
    this.name = 'WeightTableMissingError'
  }
}

/**
 * PostgREST's "the table itself doesn't exist yet" signature — distinct from mealsRepo's
 * isMissingColumnError (PGRST204, missing *column*). A missing *table* comes back as PGRST205
 * with a "Could not find the table ... in the schema cache" message, or occasionally the
 * underlying Postgres 42P01 (undefined_table) if a request bypasses PostgREST's own cache check.
 * Checked broadly on purpose so a real migration-not-run state is distinguishable from any other
 * real error (bad payload, RLS rejection, network failure).
 */
function isMissingWeightTableError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    /could not find the table/i.test(error.message ?? '') ||
    /relation .*weight_logs.* does not exist/i.test(error.message ?? '')
  )
}

/** Logs one real weight entry for `userId`. Throws WeightTableMissingError if the migration
 * hasn't been run yet, else a generic Error carrying the real Supabase message. */
export async function insertWeightLog(userId: string, weightKg: number, loggedAt = new Date()): Promise<WeightLog> {
  const { data, error } = await supabase
    .from('weight_logs')
    .insert({ user_id: userId, weight_kg: weightKg, logged_at: loggedAt.toISOString() })
    .select()
    .single<WeightLogRow>()

  if (isMissingWeightTableError(error)) throw new WeightTableMissingError()
  if (error || !data) throw new Error(`Failed to log weight: ${error?.message ?? 'no row returned'}`)
  return rowToWeightLog(data)
}

/** All of this user's weight entries at/after `sinceISO`, oldest first (chart-ready order).
 * Same WeightTableMissingError/generic-Error split as insertWeightLog above. */
export async function listWeightLogsSince(userId: string, sinceISO: string): Promise<WeightLog[]> {
  const { data, error } = await supabase
    .from('weight_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', sinceISO)
    .order('logged_at', { ascending: true })
    .returns<WeightLogRow[]>()

  if (isMissingWeightTableError(error)) throw new WeightTableMissingError()
  if (error) throw new Error(`Failed to load weight logs: ${error.message}`)
  return (data ?? []).map(rowToWeightLog)
}
