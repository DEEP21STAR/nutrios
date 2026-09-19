/**
 * Settings entry point — a bare gear tested as too easy to miss, and the orbiting-text ring that
 * replaced it traded that problem for a new one: spinning text reads as decoration, not a label,
 * at this size. This version keeps the word "Menu" permanently static and horizontal (legible at
 * a glance, no motion to fight) inside a glass pill, with only the gear itself still turning slowly
 * for the "alive" eye-candy cue — label and animation no longer compete for the same reading.
 */
export function SettingsMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Menu — Settings"
      className="glass absolute right-4 top-2 flex items-center gap-1.5 rounded-full py-1.5 pl-2 pr-3"
      style={{
        border: '1px solid rgb(139 92 246 / 0.4)',
        boxShadow: '0 0 14px -2px rgb(139 92 246 / 0.55)',
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="animate-[spin_6s_linear_infinite] text-accent-health"
        style={{ filter: 'drop-shadow(0 0 4px var(--glow-health))' }}
      >
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.4.6a7.6 7.6 0 0 0-1.7-1l-.3-2.5H9l-.3 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-.6-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.4-.6a7.6 7.6 0 0 0 1.7 1l.3 2.5h6l.3-2.5a7.6 7.6 0 0 0 1.7-1l2.4.6 2-3.4-2-1.5Z" />
      </svg>
      <span
        className="text-caption font-bold tracking-[0.15em]"
        style={{ color: '#c4b5fd', textShadow: '0 0 8px rgb(139 92 246 / 0.7)' }}
      >
        MENU
      </span>
    </button>
  )
}
