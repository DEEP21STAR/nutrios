-- Restaurant/Takeaway Mode (Phase 3, 2026-09-16) — adds the two meal-level columns the
-- "Eating Out" tag needs. Same one-time manual step as 0001_init.sql: this app only ever holds
-- the publishable/anon key, which cannot run DDL by Postgres/PostgREST design regardless of RLS
-- state — no service_role/secret key or Supabase CLI access is available in this environment.
-- Run this once, by hand, in the Supabase SQL Editor (SQL Editor -> paste -> Run), same place
-- 0001_init.sql was run.
--
-- SAFE TO RUN EVEN IF ALREADY APPLIED: both `if not exists` guards make this idempotent.
--
-- UNTIL THIS IS RUN: the app still works end-to-end for every existing capture path (photo,
-- voice, menu) — src/lib/mealsRepo.ts's insertMeal() detects the missing-column error from
-- PostgREST and automatically retries the insert without is_eating_out/restaurant_name, so a
-- meal is never lost. The only real effect of not running this yet is that the "Eating Out" tag
-- and restaurant name won't survive a reload or sync to another device — they still display
-- correctly in the current browser tab/session because App.tsx keeps them in local state too.

alter table public.meals add column if not exists is_eating_out boolean not null default false;
alter table public.meals add column if not exists restaurant_name text;
