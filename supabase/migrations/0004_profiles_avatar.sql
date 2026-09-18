-- ---------------------------------------------------------------------------
-- profiles — one row per user, currently just the avatar. A real name/handle
-- column can be added later once real multi-user identity exists (see
-- lib/togetherDemo.ts's own header comment on why Together Mode is demo-only
-- for anyone but you right now) — this migration only unblocks the avatar
-- picker in Settings, not a full profile system.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  avatar_url text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
create policy "profiles_upsert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id);

grant select, insert, update on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: avatars bucket — PUBLIC (unlike meal-photos), since an avatar is
-- meant to be shown to other people in Together Mode once real multi-user
-- identity exists. A plain public URL, not a signed one, is the correct fit
-- for that — same reasoning Discord/Slack use for avatar storage.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Path convention: <user_id>/<filename> — only the owner can write/delete their own folder.
-- A SELECT policy is required too, even though the bucket's own public flag handles anonymous
-- reads for OTHER people's avatars: real bug hit and fixed live (2026-09-18) — the client's
-- upload() call uses upsert:true (so re-uploading a new photo replaces the old one instead of
-- accumulating orphaned files), and Storage's upsert path needs to look up whether the row
-- already exists first. Without SELECT, that lookup silently fails and the whole upload gets
-- rejected with a generic "row violates row-level security policy" error that looks exactly
-- like an INSERT/WITH CHECK problem — it took directly simulating the WITH CHECK expression
-- (it evaluated true) to rule that out before finding the actual gap.
create policy "avatars_select_own" on storage.objects
  for select using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]
  );
