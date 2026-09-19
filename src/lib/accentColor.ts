/**
 * Real theme customization, not just dark/light — lets a user pick their own primary accent
 * (the color driving the calorie ring, buttons, streak banner, CTAs — everywhere the app uses
 * `--color-accent-health`). Deliberately a curated preset list, not a raw color picker: an
 * unconstrained picker produces low-contrast/illegible combinations against the dark ground, a
 * handful of hand-tuned options keeps every choice looking intentional. `--color-accent-ai`
 * (violet, Premium) and `--color-accent-energy` (amber, warnings) stay fixed — they carry
 * specific meaning elsewhere in the UI, not just decoration, so they're not part of this picker.
 */
export type AccentColor = 'emerald' | 'violet' | 'amber' | 'rose' | 'sky' | 'lime'

export const ACCENT_PRESETS: Record<AccentColor, { label: string; hex: string; glow: string }> = {
  emerald: { label: 'Emerald', hex: '#00e5a0', glow: 'rgb(0 229 160 / 0.35)' },
  violet: { label: 'Violet', hex: '#8b5cf6', glow: 'rgb(139 92 246 / 0.35)' },
  amber: { label: 'Amber', hex: '#ffb800', glow: 'rgb(255 184 0 / 0.35)' },
  rose: { label: 'Rose', hex: '#ff5e8a', glow: 'rgb(255 94 138 / 0.35)' },
  sky: { label: 'Sky', hex: '#3b9dff', glow: 'rgb(59 157 255 / 0.35)' },
  lime: { label: 'Lime', hex: '#a3e635', glow: 'rgb(163 230 53 / 0.35)' },
}

const STORAGE_KEY = 'nutrios.accentColor.v1'
const DEFAULT_ACCENT: AccentColor = 'emerald'

export function getStoredAccentColor(): AccentColor {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && stored in ACCENT_PRESETS ? (stored as AccentColor) : DEFAULT_ACCENT
  } catch {
    return DEFAULT_ACCENT
  }
}

/** Applies the accent to the document root and persists it. Call once on boot with the stored
 * value, and again on every change — same pattern as `applyTheme` in `lib/theme.ts`. */
export function applyAccentColor(accent: AccentColor) {
  const preset = ACCENT_PRESETS[accent]
  document.documentElement.style.setProperty('--color-accent-health', preset.hex)
  document.documentElement.style.setProperty('--glow-health', preset.glow)
  try {
    localStorage.setItem(STORAGE_KEY, accent)
  } catch {
    // Nice-to-have persistence only — the accent still applies for this session either way.
  }
}
