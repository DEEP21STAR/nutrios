-- Weight logging (Phase 5, Trends & History, 2026-09-17) — adds the `weight_logs` table the new
-- weight-trend chart needs. Same one-time manual step as 0001_init.sql/0002_eating_out.sql: this
-- app only ever holds the publishable/anon key, which cannot run DDL by Postgres/PostgREST design
-- regardless of RLS state — no service_role/secret key or Supabase CLI access is available in this
-- environment. Run this once, by hand, in the Supabase SQL Editor (SQL Editor -> paste -> Run),
-- same place 0001/0002 were run.
--
-- SAFE TO RUN EVEN IF ALREADY APPLIED: every guard below (`if not exists`, the publication DO
-- block) is idempotent.
--
-- UNTIL THIS IS RUN: src/lib/weightRepo.ts's insertWeightLog/listWeightLogs calls will fail with
-- a "Could not find the table" error from PostgREST. src/components/TrendsHistory.tsx catches that
-- specific error and shows a plain-language "run this migration" notice instead of crashing or
-- fabricating a fake trend line — see that file's own header comment.

create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg < 500),
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.weight_logs enable row level security;

create policy "weight_logs_select_own" on public.weight_logs
  for select using (auth.uid() = user_id);
create policy "weight_logs_insert_own" on public.weight_logs
  for insert with check (auth.uid() = user_id);
create policy "weight_logs_update_own" on public.weight_logs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weight_logs_delete_own" on public.weight_logs
  for delete using (auth.uid() = user_id);

create index if not exists weight_logs_user_logged_at_idx on public.weight_logs (user_id, logged_at desc);

-- Realtime — same cross-device live-sync treatment as `meals` in 0001_init.sql. Wrapped in a DO
-- block because, unlike `create table if not exists`, `alter publication ... add table` has no
-- built-in "if not exists" guard in Postgres — this just swallows the "already a member" error on
-- a re-run instead of failing the whole script.
do $$
begin
  alter publication supabase_realtime add table public.weight_logs;
exception
  when duplicate_object then null;
end $$;
