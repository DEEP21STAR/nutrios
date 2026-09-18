import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ShutterMark } from '@/components/ShutterMark'

/**
 * The real cinematic sequence: the shutter mechanically spins open (real SVG geometry rotating,
 * not a raster fade), the wordmark focus-pulls into sharpness (a lens finding focus, not a
 * plain fade), then the whole splash irises down to a point at its own center — a real clip-path
 * shrink, not a cross-fade — revealing the actual app already mounted underneath it (see
 * App.tsx's render structure: the splash is an overlay alongside real content, not a gate in
 * front of it, specifically so this reveal has something real to reveal).
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [bladeRotation, setBladeRotation] = useState(28)
  const wordmarkRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      // No motion at all, just a short honest pause on the finished state before handing off —
      // still real content, not skipped, just not animated into that state.
      setBladeRotation(0)
      const t = setTimeout(onDone, 500)
      return () => clearTimeout(t)
    }

    const tl = gsap.timeline({ onComplete: onDone })
    const bladeState = { rotation: 28 }

    tl.to(bladeState, {
      rotation: 0,
      duration: 0.7,
      ease: 'back.out(1.4)',
      onUpdate: () => setBladeRotation(bladeState.rotation),
    })
      .fromTo(
        wordmarkRef.current,
        { opacity: 0, filter: 'blur(10px)', y: 6 },
        { opacity: 1, filter: 'blur(0px)', y: 0, duration: 0.5, ease: 'power2.out' },
        '-=0.15',
      )
      .to({}, { duration: 0.5 }) // hold on the finished, legible state before the iris closes
      .to(rootRef.current, {
        clipPath: 'circle(0% at 50% 50%)',
        duration: 0.55,
        ease: 'power3.in',
      })

    return () => {
      tl.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDone is stable for the splash's
    // one real lifecycle; re-running this on every render would restart the whole sequence.
  }, [])

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-primary"
      style={{ clipPath: 'circle(150% at 50% 50%)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <ShutterMark bladeRotation={bladeRotation} size={120} />
        <div ref={wordmarkRef} className="flex items-baseline gap-0.5" style={{ opacity: 0 }}>
          <span
            className="text-2xl font-bold tracking-[0.2em] text-text-primary"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            NUTRIOS
          </span>
        </div>
      </div>
    </div>
  )
}
