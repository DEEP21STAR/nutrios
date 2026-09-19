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
/**
 * Real, observed-in-production error (not theoretical): PostgREST occasionally rejects a
 * freshly-minted anonymous JWT with `PGRST303 "JWT issued at future"` — a genuine clock-skew gap
 * between Supabase's auth service (which mints the token) and the database's own PostgREST
 * instance (which validates it), not a bug in this app. It's inherently transient — wall-clock
 * time catches up within ~1-2s — and can hit ANY request through this client (meals, goals,
 * workouts, whichever repo call happens to fire in that window), so the fix belongs at the fetch
 * layer, once, rather than patched into every individual repo function.
 */
export async function fetchWithJwtSkewRetry(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init)
  if (res.status !== 401) return res

  const body = await res.clone().text().catch(() => '')
  if (!body.includes('PGRST303') && !body.includes('JWT issued at future')) return res

  await new Promise((r) => setTimeout(r, 1200))
  return fetch(input, init)
}

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  global: { fetch: fetchWithJwtSkewRetry },
})
