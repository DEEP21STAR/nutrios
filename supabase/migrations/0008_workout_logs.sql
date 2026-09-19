-- Workout tracking (2026-09-19) -- adds the `workout_logs` table the new "Log a workout" flow
-- needs. Same one-time manual step as every prior migration in this project: this app only ever
-- holds the publishable/anon key, which cannot run DDL by Postgres/PostgREST design regardless of
-- RLS state -- no service_role/secret key or Supabase CLI access is available in this environment.
-- Run this once, by hand, in the Supabase SQL Editor (SQL Editor -> paste -> Run), same place
-- every earlier migration was run.
--
-- SAFE TO RUN EVEN IF ALREADY APPLIED: every guard below (`if not exists`, the publication DO
-- block) is idempotent.
--
-- UNTIL THIS IS RUN: src/lib/workoutsRepo.ts's insertWorkout/listWorkoutsSince calls will fail
-- with a "Could not find the table" error from PostgREST -- same documented failure mode as
-- 0003_weight_log.sql, handled the same honest way (a plain "run this migration" notice, not a
-- crash or a fabricated result).

create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_type text not null,
  duration_min numeric not null check (duration_min > 0 and duration_min < 600),
  calories_burned numeric not null check (calories_burned >= 0),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.workout_logs enable row level security;

create policy "workout_logs_select_own" on public.workout_logs
  for select using (auth.uid() = user_id);
create policy "workout_logs_insert_own" on public.workout_logs
  for insert with check (auth.uid() = user_id);
create policy "workout_logs_update_own" on public.workout_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "workout_logs_delete_own" on public.workout_logs
  for delete using (auth.uid() = user_id);

create index if not exists workout_logs_user_logged_at_idx on public.workout_logs (user_id, logged_at desc);

-- Realtime -- same cross-device live-sync treatment as `meals`/`weight_logs`.
do $$
begin
  alter publication supabase_realtime add table public.workout_logs;
exception
  when duplicate_object then null;
end $$;
