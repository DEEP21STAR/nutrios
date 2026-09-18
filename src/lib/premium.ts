const PREMIUM_KEY = 'nutrios.premium.v1'

/**
 * Honor-system unlock, not a real payment integration — there's no payment processor wired up
 * (Deep's own donation link/account details still need to be decided; see SettingsPanel's
 * Premium section). This just remembers the choice per-device. If/when a real donation flow
 * exists, this is the one function that needs to change to something server-verified.
 */
export function isPremiumUnlocked(): boolean {
  try {
    return localStorage.getItem(PREMIUM_KEY) === '1'
  } catch {
    return false
  }
}

export function setPremiumUnlocked(unlocked: boolean): void {
  try {
    if (unlocked) localStorage.setItem(PREMIUM_KEY, '1')
    else localStorage.removeItem(PREMIUM_KEY)
  } catch {
    // Private browsing / storage disabled — the toggle just won't persist across reloads.
  }
}
