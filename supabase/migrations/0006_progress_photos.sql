-- ---------------------------------------------------------------------------
-- progress_photos — one row per captured progress photo. Private by default
-- (unlike avatars): these are personal body-progress photos, not something
-- shown to other people automatically, matching the privacy-first pattern
-- every real progress-photo app researched uses (on-device/private by
-- default, sharing is an explicit per-photo action via the OS share sheet,
-- not automatic visibility to anyone else).
-- ---------------------------------------------------------------------------
create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  taken_at timestamptz not null default now(),
  weight_kg numeric,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists progress_photos_user_taken_idx on public.progress_photos (user_id, taken_at desc);

alter table public.progress_photos enable row level security;

create policy "progress_photos_select_own" on public.progress_photos
  for select using (auth.uid() = user_id);
create policy "progress_photos_insert_own" on public.progress_photos
  for insert with check (auth.uid() = user_id);
create policy "progress_photos_delete_own" on public.progress_photos
  for delete using (auth.uid() = user_id);

grant select, insert, delete on public.progress_photos to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: progress-photos bucket — PRIVATE (like meal-photos, unlike
-- avatars), served via signed URLs. Path convention: <user_id>/<filename>,
-- same convention as avatars/meal-photos. No upsert path here (every capture
-- is a brand-new file, never overwritten), so unlike the avatars bucket this
-- genuinely doesn't need a SELECT policy for an upsert lookup — but it's
-- still needed for the client to read back its own uploaded photos at all,
-- for the exact same "bucket's own public flag only covers anonymous reads"
-- reason documented on the avatars bucket in 0004.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('progress-photos', 'progress-photos', false)
on conflict (id) do nothing;

create policy "progress_photos_storage_select_own" on storage.objects
  for select using (
    bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "progress_photos_storage_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "progress_photos_storage_delete_own" on storage.objects
  for delete using (
    bucket_id = 'progress-photos' and auth.uid()::text = (storage.foldername(name))[1]
  );
