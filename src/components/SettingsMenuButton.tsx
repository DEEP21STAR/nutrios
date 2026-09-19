/**
 * Settings entry point — the plain gear icon alone tested as too easy to miss/misread (Deep's
 * report: not everyone recognizes a bare gear as "menu"). A slow-spinning neon ring of the word
 * MENU orbiting the gear, always in motion, is both a legibility fix (the word is right there)
 * and the "eye candy" pass this screen was missing — matches the splash/footer's existing neon
 * text-glow language rather than inventing a new visual style.
 */
export function SettingsMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Menu — Settings" className="absolute right-4 top-2 h-16 w-16">
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full animate-[spin_9s_linear_infinite]"
        style={{ filter: 'drop-shadow(0 0 5px rgb(139 92 246 / 0.75))' }}
      >
        <defs>
          <path id="settingsMenuRing" d="M 50,50 m -40,0 a 40,40 0 1,1 80,0 a 40,40 0 1,1 -80,0" />
        </defs>
        <text fill="#8b5cf6" fontSize="13" fontWeight="700" letterSpacing="2.5">
          <textPath href="#settingsMenuRing" startOffset="0%">
            MENU &#8226; MENU &#8226; MENU &#8226;
          </textPath>
        </text>
      </svg>
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        className="absolute inset-0 m-auto text-accent-health"
        style={{ filter: 'drop-shadow(0 0 4px var(--glow-health))' }}
      >
        <circle cx="12" cy="12" r="3.2" />
        <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.4.6a7.6 7.6 0 0 0-1.7-1l-.3-2.5H9l-.3 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-.6-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.4-.6a7.6 7.6 0 0 0 1.7 1l.3 2.5h6l.3-2.5a7.6 7.6 0 0 0 1.7-1l2.4.6 2-3.4-2-1.5Z" />
      </svg>
    </button>
  )
}
