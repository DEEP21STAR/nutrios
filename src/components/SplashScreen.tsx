import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { interpolate } from 'flubber'
import { MORPH_SHAPES } from '@/lib/morphShapes'

const SEGMENT_DURATION = 0.55
const POP_IN_DURATION = 0.3
const WORDMARK_DURATION = 0.45
const HOLD_DURATION = 0.3
const IRIS_DURATION = 0.5
const TOTAL_ESTIMATE_MS =
  (POP_IN_DURATION +
    (MORPH_SHAPES.length - 1) * SEGMENT_DURATION +
    WORDMARK_DURATION +
    HOLD_DURATION +
    IRIS_DURATION) *
  1000

/**
 * The real cinematic sequence Deep asked for: a journey through what the app tracks — an apple
 * morphs into a bowl of food, into a dumbbell, into a scale — before resolving into the app's
 * own mark and revealing the real app mounted underneath. The morphing itself is real SVG path
 * interpolation (flubber), not a cross-fade between icons.
 *
 * The splash must never be able to trap someone behind it. `finish()` is guarded so it only
 * fires once, and a plain `setTimeout` watchdog calls it unconditionally after the animation's
 * own worst-case duration — setTimeout keeps running even when a backgrounded tab suspends
 * requestAnimationFrame (the failure mode that left an earlier version of this splash stuck
 * showing nothing but its own opaque background, permanently hiding the app and the starfield
 * behind it). The GSAP timeline is the intended path; the watchdog is the guarantee.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const pathRef = useRef<SVGPathElement>(null)
  const groupRef = useRef<SVGGElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)
  const wordmarkRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      onDone()
    }
    const watchdog = setTimeout(finish, TOTAL_ESTIMATE_MS + 2000)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      if (pathRef.current) {
        const last = MORPH_SHAPES[MORPH_SHAPES.length - 1]
        pathRef.current.setAttribute('d', last.d)
        pathRef.current.setAttribute('fill', last.color)
      }
      const t = setTimeout(finish, 500)
      return () => {
        clearTimeout(watchdog)
        clearTimeout(t)
      }
    }

    const interpolators = MORPH_SHAPES.slice(0, -1).map((shape, i) =>
      interpolate(shape.d, MORPH_SHAPES[i + 1].d, { maxSegmentLength: 4 }),
    )

    const tl = gsap.timeline({ onComplete: finish })
    const morphState = { segment: 0 }

    tl.from(groupRef.current, { scale: 0, opacity: 0, duration: POP_IN_DURATION, ease: 'back.out(2)' })

    MORPH_SHAPES.slice(0, -1).forEach((_shape, i) => {
      const nextShape = MORPH_SHAPES[i + 1]
      tl.to(
        morphState,
        {
          segment: i + 1,
          duration: SEGMENT_DURATION,
          ease: 'power2.inOut',
          onUpdate: () => {
            const localT = morphState.segment - i
            pathRef.current?.setAttribute('d', interpolators[i](localT))
          },
        },
        i === 0 ? undefined : '+=0.03',
      )
      tl.to(pathRef.current, { fill: nextShape.color, duration: SEGMENT_DURATION, ease: 'power2.inOut' }, '<')
    })

    tl.to(ringRef.current, { opacity: 1, strokeWidth: 8, duration: 0.3, ease: 'power2.out' }, '<')
      .fromTo(
        wordmarkRef.current,
        { opacity: 0, filter: 'blur(10px)', y: 6 },
        { opacity: 1, filter: 'blur(0px)', y: 0, duration: WORDMARK_DURATION, ease: 'power2.out' },
      )
      .to({}, { duration: HOLD_DURATION })
      .to(rootRef.current, { clipPath: 'circle(0% at 50% 50%)', duration: IRIS_DURATION, ease: 'power3.in' })

    return () => {
      clearTimeout(watchdog)
      tl.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the splash's one real lifecycle
  }, [])

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-bg-primary"
      style={{ clipPath: 'circle(150% at 50% 50%)' }}
    >
      <div className="flex flex-col items-center gap-5">
        <svg width="130" height="130" viewBox="0 0 200 200" style={{ overflow: 'visible' }}>
          <defs>
            <radialGradient id="morph-glow" cx="50%" cy="50%" r="50%">
              <stop offset="55%" stopColor="var(--color-accent-health)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--color-accent-health)" stopOpacity="0.4" />
            </radialGradient>
          </defs>
          <circle cx="100" cy="100" r="94" fill="url(#morph-glow)" />
          <circle
            ref={ringRef}
            cx="100"
            cy="100"
            r="88"
            fill="none"
            stroke="var(--color-accent-health)"
            strokeWidth="4"
            opacity="0.55"
            style={{ filter: 'drop-shadow(0 0 8px var(--glow-health))' }}
          />
          <g ref={groupRef} style={{ transformOrigin: '100px 100px' }}>
            <path
              ref={pathRef}
              d={MORPH_SHAPES[0].d}
              fill={MORPH_SHAPES[0].color}
              style={{ filter: 'drop-shadow(0 3px 12px rgba(0,0,0,0.45))' }}
            />
          </g>
        </svg>
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
