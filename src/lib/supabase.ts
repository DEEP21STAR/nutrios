import { createClient } from '@supabase/supabase-js'

/**
 * Real Supabase project, live as of 2026-09-12 (URL + publishable key from
 * the coordinator). Verified before writing this: `createClient(url, key)`
 * accepts the new `sb_publishable_...` key format directly — confirmed via
 * Supabase's own docs (the publishable key is a drop-in replacement for the
 * old JWT-format anon key, same low-privilege/RLS behaviour, different
 * format only) — not assumed compatible with older anon-key-era tutorials.
 *
 * The publishable key is meant to be embedded in client code (same category
 * as a Stripe publishable key) — it is not a secret. The secret key
 * (`sb_secret_...`) was deliberately never shared with this session and is
 * never used here; this app has no server component.
 */
export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
