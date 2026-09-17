import type { ReactNode } from 'react'

/**
 * Custom neon tab icons for the new bottom nav (Deep: "styley... flash...
 * neon... what type of icon custom it as well"). Hand-drawn stroke SVGs,
 * not an icon-font/emoji set, each echoing the section's own existing motif
 * so the tab bar reads as part of this app rather than a generic template:
 * Today = the same concentric-ring language as TodayRing, Progress = an
 * ascending trend line (Trends & History + Achievements combined), Together
 * = two linked orbits. Glow uses the SAME --glow-* tokens as everywhere else
 * in the app (InputOrbButton, RadialProgress) — one lighting system, not a
 * second palette invented for nav only.
 */
function IconShell({
  active,
  color,
  glow,
  children,
}: {
  active: boolean
  color: string
  glow: string
  children: ReactNode
}) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      className="transition-all duration-300"
      style={{
        color: active ? color : 'var(--color-text-muted)',
        filter: active ? `drop-shadow(0 0 5px ${glow}) drop-shadow(0 0 10px ${glow})` : 'none',
      }}
    >
      {children}
    </svg>
  )
}

export function TodayTabIcon({ active }: { active: boolean }) {
  return (
    <IconShell active={active} color="var(--color-accent-health)" glow="var(--glow-health)">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" opacity="0.35" />
      <circle cx="12" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.6" opacity="0.65" />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" />
    </IconShell>
  )
}

export function ProgressTabIcon({ active }: { active: boolean }) {
  return (
    <IconShell active={active} color="var(--color-accent-energy)" glow="var(--glow-energy)">
      <path
        d="M4 16.5L9 11.5L13 14.5L20 6.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M15 6.5H20V11.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="9" cy="11.5" r="1.4" fill="currentColor" />
      <circle cx="13" cy="14.5" r="1.4" fill="currentColor" />
    </IconShell>
  )
}

export function TogetherTabIcon({ active }: { active: boolean }) {
  return (
    <IconShell active={active} color="var(--color-accent-ai)" glow="var(--glow-ai)">
      <circle cx="9" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.6" opacity="0.8" />
      <circle cx="15" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.6" opacity="0.8" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
    </IconShell>
  )
}
