const RING_COLOR = '#00e5a0'

/**
 * Settings entry point — third design, real feedback each round: a bare gear was too easy to
 * miss; orbiting text traded that for illegible spinning text; a static gear+label pill fixed
 * legibility but still read as a generic system icon, not "this app's menu". This version uses
 * NUTRYOS's own ring mark (the exact shape from the splash's brand stamp — see RING_COLOR there)
 * as the icon instead of a borrowed gear glyph, for real brand recognition, and moves the "keeps
 * circling" motion Deep asked for onto a decorative comet-trail glow arc around the ring rather
 * than onto the word itself — motion for delight and readable text no longer compete for the same
 * element, the actual lesson from the previous round.
 */
export function SettingsMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Menu — Settings"
      className="glass absolute right-4 top-2 flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3"
      style={{
        border: `1px solid ${RING_COLOR}66`,
        boxShadow: `0 0 14px -2px ${RING_COLOR}80`,
      }}
    >
      <span className="relative flex h-7 w-7 items-center justify-center">
        <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full animate-[spin_4s_linear_infinite]">
          <defs>
            <linearGradient id="menuCometTrail" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={RING_COLOR} stopOpacity="0" />
              <stop offset="100%" stopColor={RING_COLOR} stopOpacity="0.95" />
            </linearGradient>
          </defs>
          <circle
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="url(#menuCometTrail)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray="70 207"
          />
        </svg>
        <svg viewBox="0 0 100 100" className="relative h-[18px] w-[18px]" style={{ filter: `drop-shadow(0 0 5px ${RING_COLOR})` }}>
          <circle cx="50" cy="50" r="38" fill="none" stroke={RING_COLOR} strokeWidth="12" />
        </svg>
      </span>
      <span
        className="text-caption font-bold tracking-[0.15em]"
        style={{ color: RING_COLOR, textShadow: `0 0 8px ${RING_COLOR}b3` }}
      >
        MENU
      </span>
    </button>
  )
}
