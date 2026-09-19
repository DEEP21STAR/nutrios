import { supabase } from '@/lib/supabase'

/**
 * Anonymous → permanent account upgrade via Supabase's real linkIdentity() API (verified against
 * the installed @supabase/auth-js type definitions and current docs before writing this, not
 * assumed). NUTRIOS/NUTRYOS has run on signInAnonymously() from the start (see auth.ts) — real,
 * genuine consequence: clearing browser data, switching devices, or reinstalling loses access to
 * everything (meals, goals, progress photos) permanently, since there's no email/password to
 * prove "this is the same person" on a new device. This is the opt-in fix: linking Google keeps
 * the EXACT SAME account (same auth.uid(), zero data migration) but makes it recoverable.
 *
 * Requires two one-time steps in the Supabase Dashboard that only Deep can do (real OAuth
 * credentials + a security toggle, not something the publishable key can enable):
 *   1. Authentication -> Sign In / Up -> Google -> add real Client ID/Secret from Google Cloud
 *      Console (Authorized redirect URI there must be the Supabase project's own callback URL,
 *      shown on that same settings page).
 *   2. Authentication -> Sign In / Up -> "Allow manual linking" -> on.
 *   3. Authentication -> URL Configuration -> Redirect URLs -> add the live site URL
 *      (https://deep21star.github.io/nutryos/) -- Supabase refuses to redirect back to any URL
 *      not on this allowlist, the single most common OAuth setup mistake.
 * Until all three are done, linkGoogleAccount() will reject with a real error from Supabase
 * (surfaced to the caller, never swallowed) rather than silently failing.
 */
export async function isGoogleLinked(): Promise<boolean> {
  const { data, error } = await supabase.auth.getUserIdentities()
  if (error || !data) return false
  return data.identities.some((identity) => identity.provider === 'google')
}

export async function isAnonymousAccount(): Promise<boolean> {
  const { data } = await supabase.auth.getUser()
  return data.user?.is_anonymous ?? false
}

/** Redirects the browser to Google's consent screen. On return, the SAME account (same
 * auth.uid(), same data) is now permanently recoverable via that Google identity. */
export async function linkGoogleAccount(): Promise<void> {
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/nutryos/` },
  })
  if (error) throw new Error(error.message)
  if (data.url) window.location.href = data.url
}
