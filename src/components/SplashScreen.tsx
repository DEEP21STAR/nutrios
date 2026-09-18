import { useEffect, useState } from 'react'

const VISIBLE_MS = 1600
const FADE_MS = 400

/**
 * First-paint brand moment — shown once per app load, before anything else mounts visually.
 * Deliberately restrained per the real 2026 logo-animation research this was built from: one
 * clear idea (mark settles in, glows once, fades), under 2.5s total, not a shower of effects —
 * a longer/busier splash reads as a loading screen, not a brand moment.
 *
 * References the wordmark via `import.meta.env.BASE_URL` rather than a hardcoded leading slash
 * — this app is served from a GitHub Pages subpath (/nutrios/), so a literal `/nutrios-wordmark.png`
 * would 404 in production even though it resolves fine in local dev at the root.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const visibleMs = reduceMotion ? 400 : VISIBLE_MS
    const fadeMs = reduceMotion ? 0 : FADE_MS

    const fadeTimer = setTimeout(() => setFading(true), visibleMs)
    const doneTimer = setTimeout(onDone, visibleMs + fadeMs)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onDone])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-primary transition-opacity ease-out"
      style={{ opacity: fading ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
    >
      <div className="splash-ring" aria-hidden />
      <img
        src={`${import.meta.env.BASE_URL}nutrios-wordmark.png`}
        alt="NUTRIOS"
        className="splash-mark relative w-[min(70vw,320px)]"
      />
    </div>
  )
}
