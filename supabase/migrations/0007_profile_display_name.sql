-- Adds a display name to the existing profiles table (0004_profiles_avatar.sql) — used to
-- personalize the Whetū Digital footer's "Built with care for <name>" line. Nullable: falls
-- back to "you" until the user actually sets one.
alter table public.profiles add column if not exists display_name text;
