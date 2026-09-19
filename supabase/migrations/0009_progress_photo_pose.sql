-- ---------------------------------------------------------------------------
-- progress_photos.pose — named pose slot (Front/Side/Back) so the alignment
-- guide in ProgressPhotoCapture can ghost the last photo of the SAME pose
-- instead of just "whatever was captured most recently", and so the gallery
-- can group by pose. Nullable: every photo captured before this migration
-- has no pose and stays valid, shown as "unsorted" rather than breaking.
-- No grant changes needed — this is a column add on a table that already has
-- select/insert/delete granted to authenticated (see 0006).
-- ---------------------------------------------------------------------------
alter table public.progress_photos
  add column if not exists pose text check (pose is null or pose in ('front', 'side', 'back'));
