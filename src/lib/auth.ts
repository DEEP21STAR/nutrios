import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

/**
 * This is a single-user personal app with no login screen in the current
 * scope, but every table's RLS policy is scoped to `auth.uid()` (explicit
 * requirement) — so a real authenticated user is still needed. Supabase's
 * anonymous sign-in (`signInAnonymously()`) is the real, documented fit: it
 * creates a genuine `auth.users` row and issues a real JWT with a real
 * `auth.uid()`, satisfying RLS, without requiring email/password UI.
 *
 * REAL, LIVE BLOCKER found while wiring this up: this project's Auth
 * settings have "Anonymous Sign-Ins" OFF (confirmed via a live call to
 * `/auth/v1/signup` against the actual project, which returned
 * `anonymous_provider_disabled` — not assumed). This is a project-level
 * toggle in the Supabase Dashboard that the publishable key cannot flip.
 * Deep needs to enable it once: Dashboard → Authentication → Sign In / Up →
 * Anonymous Sign-Ins → On. Until then, every call in this file will reject
 * with that same error — surfaced honestly to the caller, not swallowed.
 *
 * REAL BUG FOUND AND FIXED (2026-09-18): React StrictMode double-invokes
 * App.tsx's bootstrap effect in dev, so this function can genuinely be
 * called twice concurrently before either `signInAnonymously()` call
 * resolves. Without a guard, that creates TWO different anonymous users —
 * whichever sign-in resolves last becomes the Supabase client's actual
 * active session, while a component holding the FIRST call's resolved
 * user id in React state is now stale. The exact, reproduced symptom:
 * `goalsRepo.saveGoals()` failed with "new row violates row-level security
 * policy for table \"goals\"" — the request was authenticated as the
 * second user but tagged with the first user's id, and RLS's own
 * `auth.uid() = user_id` check correctly rejected the mismatch. This had
 * likely been silently affecting reads too (a stale id just returns zero
 * rows, no visible error) — the goals write is just the first thing loud
 * enough to surface it. Fix: cache the in-flight promise so a second
 * concurrent call awaits the SAME sign-in instead of starting a new one.
 */
let inFlight: Promise<User> | null = null

export async function ensureAuthenticated(): Promise<User> {
  if (inFlight) return inFlight

  inFlight = (async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      if (sessionData.session?.user) return sessionData.session.user

      const { data, error } = await supabase.auth.signInAnonymously()
      if (error || !data.user) {
        throw new Error(
          `Supabase anonymous sign-in failed (${error?.message ?? 'no user returned'}). ` +
            'If this says "Anonymous sign-ins are disabled", enable it in the Supabase Dashboard: ' +
            'Authentication → Sign In / Up → Anonymous Sign-Ins.',
        )
      }
      return data.user
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}
