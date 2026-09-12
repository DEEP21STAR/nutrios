-- Calorie Tracker — initial schema, RLS policies, and storage bucket.
--
-- WHY THIS FILE EXISTS RATHER THAN BEING APPLIED AUTOMATICALLY: creating
-- tables/policies/buckets is a DDL/admin operation. The app only has the
-- publishable (anon-equivalent) key, which — by Postgres/PostgREST design —
-- can NEVER run DDL regardless of RLS state. No Supabase CLI is installed
-- and no service_role/secret key or personal access token is available in
-- this environment (correctly: the secret key was deliberately not shared).
-- Run this once, by hand, in the Supabase SQL Editor.
--
-- "Automatically expose new tables" is OFF and "Enable automatic RLS" is ON
-- for this project (confirmed by Deep before creation) — that auto-RLS is a
-- safety net, not a substitute for the explicit policies below.

-- ---------------------------------------------------------------------------
-- meals
-- ---------------------------------------------------------------------------
create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  photo_url text,
  items jsonb not null default '[]'::jsonb,
  total_calories numeric not null default 0,
  total_protein_g numeric not null default 0,
  total_fat_g numeric not null default 0,
  total_carbs_g numeric not null default 0,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.meals enable row level security;

create policy "meals_select_own" on public.meals
  for select using (auth.uid() = user_id);
create policy "meals_insert_own" on public.meals
  for insert with check (auth.uid() = user_id);
create policy "meals_update_own" on public.meals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "meals_delete_own" on public.meals
  for delete using (auth.uid() = user_id);

create index if not exists meals_user_logged_at_idx on public.meals (user_id, logged_at desc);

-- ---------------------------------------------------------------------------
-- goals — one row per user (calorie/macro targets, TDEE inputs)
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  calorie_goal numeric not null default 2200,
  protein_goal_g numeric not null default 150,
  fat_goal_g numeric not null default 70,
  carbs_goal_g numeric not null default 220,
  updated_at timestamptz not null default now()
);

alter table public.goals enable row level security;

create policy "goals_select_own" on public.goals
  for select using (auth.uid() = user_id);
create policy "goals_upsert_own" on public.goals
  for insert with check (auth.uid() = user_id);
create policy "goals_update_own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- badges — achievements a user has unlocked
-- ---------------------------------------------------------------------------
create table if not exists public.badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

alter table public.badges enable row level security;

create policy "badges_select_own" on public.badges
  for select using (auth.uid() = user_id);
create policy "badges_insert_own" on public.badges
  for insert with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- streak_state — one row per user, current/best logging streak
-- ---------------------------------------------------------------------------
create table if not exists public.streak_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  current_streak integer not null default 0,
  best_streak integer not null default 0,
  last_logged_date date,
  updated_at timestamptz not null default now()
);

alter table public.streak_state enable row level security;

create policy "streak_select_own" on public.streak_state
  for select using (auth.uid() = user_id);
create policy "streak_upsert_own" on public.streak_state
  for insert with check (auth.uid() = user_id);
create policy "streak_update_own" on public.streak_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: meal photos bucket (private — served via signed URLs, not public)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do nothing;

-- Path convention enforced by these policies: <user_id>/<filename>.webp —
-- the app must upload to that path so (storage.foldername(name))[1] = the
-- owner's own auth.uid().
create policy "meal_photos_select_own" on storage.objects
  for select using (
    bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "meal_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "meal_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---------------------------------------------------------------------------
-- Realtime — enable change broadcasts on meals for the cross-device live
-- sync requirement (RLS still applies: a client only receives rows it's
-- allowed to select).
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.meals;
