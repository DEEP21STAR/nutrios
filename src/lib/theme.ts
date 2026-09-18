export type Theme = 'dark' | 'light'

const STORAGE_KEY = 'nutrios.theme.v1'

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === 'light' ? 'light' : 'dark'
  } catch {
    // Private browsing / storage blocked — dark is the app's real default identity, not a guess.
    return 'dark'
  }
}

/** Applies the theme to the document root and persists it. Call once on boot with the stored
 * value, and again on every toggle. */
export function applyTheme(theme: Theme) {
  if (theme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Nice-to-have persistence only — the theme still applies for this session either way.
  }
}
