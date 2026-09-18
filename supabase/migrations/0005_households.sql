-- ---------------------------------------------------------------------------
-- Real multi-user Together Mode. Answers the real question this was built
-- for: "how do you know you've got people using the app there" — you didn't,
-- until now. No email/password login needed (this app stays anonymous-auth
-- throughout) — a short shareable join code plays the same role Strava/
-- Fitbit's "join with code" flow does. One household per user, kept simple
-- on purpose (a "family," not a general social graph).
-- ---------------------------------------------------------------------------

create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'You',
  -- Same three tiers as the existing client-side-only setting (togetherDemo.ts) — everyone in
  -- your household sees your real stats unless you dial this down, exactly like before, just
  -- actually enforced server-side now instead of only gating your own device's local view.
  share_level text not null default 'friends' check (share_level in ('everyone', 'friends', 'none')),
  joined_at timestamptz not null default now()
);
create index if not exists household_members_household_id_idx on public.household_members(household_id);

-- One row per (user, challenge) — each client computes and upserts its OWN row from its own
-- real meals/goals (same math as computeYourChallengeValue), never trusting a value it received
-- from anyone else's device. Real numbers, written once, read by anyone in the same household.
create table if not exists public.member_stats (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge text not null check (challenge in ('protein', 'consistency', 'goalCrusher')),
  value numeric not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, challenge)
);

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.member_stats enable row level security;

-- REAL BUG found and fixed live (2026-09-18): a policy on household_members whose USING clause
-- queries household_members again causes "infinite recursion detected in policy for relation"
-- — Postgres re-applies the same policy to the inner subquery's own access to the table. The
-- standard fix (documented by Supabase for exactly this shape) is a SECURITY DEFINER helper
-- function, whose internal query isn't subject to the same recursive re-evaluation. Defined
-- before any policy uses it, since this migration runs top-to-bottom.
create or replace function public.is_in_household(p_household_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.household_members where household_id = p_household_id and user_id = auth.uid());
$$;
grant execute on function public.is_in_household(uuid) to authenticated;

-- households: members can see their own household's row (needed to display/share the code).
create policy "households_select_member" on public.households
  for select using (public.is_in_household(id));

-- household_members: see everyone in any household you're also a member of (your "family").
create policy "household_members_select_same_household" on public.household_members
  for select using (public.is_in_household(household_id));
create policy "household_members_update_own" on public.household_members
  for update using (auth.uid() = user_id);
create policy "household_members_delete_own" on public.household_members
  for delete using (auth.uid() = user_id);
-- Deliberately NO direct insert policy — joining/creating goes through the two functions below,
-- which validate the code and generate it server-side rather than trusting an arbitrary insert.

-- member_stats: readable by anyone who shares a household with you AND whose own share_level
-- isn't 'none' — the actual privacy-tier enforcement point. Writable only for your own row.
create policy "member_stats_select_same_household" on public.member_stats
  for select using (
    exists (
      select 1 from public.household_members them
      where them.user_id = member_stats.user_id
        and them.share_level != 'none'
        and public.is_in_household(them.household_id)
    )
  );
create policy "member_stats_upsert_own" on public.member_stats
  for insert with check (auth.uid() = user_id);
create policy "member_stats_update_own" on public.member_stats
  for update using (auth.uid() = user_id);

grant select, update, delete on public.households to authenticated;
grant select, update, delete on public.household_members to authenticated;
grant select, insert, update on public.member_stats to authenticated;
grant execute on function gen_random_uuid() to authenticated;

-- ---------------------------------------------------------------------------
-- create_household / join_household — security definer functions, so a client never inserts
-- into households/household_members directly (avoids needing a broad "select any code to check
-- it" policy, and keeps code generation/validation server-side).
-- ---------------------------------------------------------------------------
create or replace function public.create_household(p_display_name text)
returns table(household_id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_id uuid;
begin
  -- 6 uppercase alphanumeric chars, excluding visually ambiguous 0/O/1/I — a real, typeable
  -- join code, not a UUID someone has to copy-paste perfectly on a phone keyboard.
  v_code := (
    select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (random() * 32)::int + 1, 1), '')
    from generate_series(1, 6)
  );
  insert into public.households (code, created_by) values (v_code, auth.uid()) returning id into v_id;
  insert into public.household_members (household_id, user_id, display_name)
    values (v_id, auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'You'));
  return query select v_id, v_code;
end;
$$;

create or replace function public.join_household(p_code text, p_display_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from public.households where code = upper(trim(p_code));
  if v_id is null then
    raise exception 'No household found with that code';
  end if;
  insert into public.household_members (household_id, user_id, display_name)
    values (v_id, auth.uid(), coalesce(nullif(trim(p_display_name), ''), 'You'))
  on conflict (user_id) do update set household_id = excluded.household_id, display_name = excluded.display_name;
  return v_id;
end;
$$;

grant execute on function public.create_household(text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;
