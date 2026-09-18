import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { interpolate } from 'flubber'
import { MORPH_SHAPES } from '@/lib/morphShapes'

const SEGMENT_DURATION = 0.55
const POP_IN_DURATION = 0.3
const WORDMARK_DURATION = 0.45
const HOLD_DURATION = 0.35
const IRIS_DURATION = 0.5
const TOTAL_ESTIMATE_MS =
  (POP_IN_DURATION +
    (MORPH_SHAPES.length - 1) * SEGMENT_DURATION +
    WORDMARK_DURATION +
    HOLD_DURATION +
    IRIS_DURATION) *
  1000

/**
 * The real cinematic sequence: a journey through what the app tracks — apple, meal, dumbbell,
 * scale — morphing via real SVG path interpolation (flubber), before resolving into the app's
 * own mark and revealing the real app mounted underneath.
 *
 * Sized in vh, not fixed pixels — a fixed-px icon reads as a small dot lost in a sea of black on
 * a tall phone screen (confirmed against a real recorded run: ~130px on a 2500px-tall display is
 * genuinely tiny). Every dimension here scales with the viewport instead.
 *
 * The backdrop deliberately has no opaque fill: index.html's starfield canvas sits behind
 * everything, and letting it show through here (instead of covering it with a flat panel) is
 * what makes the splash feel like it belongs to the same app as the screen it reveals, rather
 * than a loading curtain in front of it.
 *
 * The splash must never be able to trap someone behind it. `finish()` is guarded so it only
 * fires once, and a plain `setTimeout` watchdog calls it unconditionally after the animation's
 * own worst-case duration — setTimeout keeps running even when a backgrounded tab suspends
 * requestAnimationFrame, which is the failure mode that once left this splash stuck forever.
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
        pathRef.current.style.color = last.color
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
      tl.to(
        pathRef.current,
        { fill: nextShape.color, color: nextShape.color, duration: SEGMENT_DURATION, ease: 'power2.inOut' },
        '<',
      )
    })

    tl.to(ringRef.current, { opacity: 1, strokeWidth: 8, duration: 0.3, ease: 'power2.out' }, '<')
      .fromTo(
        wordmarkRef.current,
        { opacity: 0, filter: 'blur(10px)', y: 8 },
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
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-[3vh] overflow-hidden"
      style={{
        clipPath: 'circle(150% at 50% 50%)',
        background:
          'radial-gradient(ellipse 70% 55% at 50% 42%, rgb(0 229 160 / 0.16) 0%, rgb(139 92 246 / 0.08) 45%, transparent 75%)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-1/4 top-[10%] h-[45vh] w-[45vh] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgb(139 92 246 / 0.18), transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-1/4 bottom-[8%] h-[40vh] w-[40vh] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgb(0 229 160 / 0.16), transparent 70%)' }}
      />

      <svg
        viewBox="0 0 200 200"
        style={{ width: 'clamp(150px, 26vh, 260px)', height: 'clamp(150px, 26vh, 260px)', overflow: 'visible' }}
      >
        <defs>
          <radialGradient id="morph-glow" cx="50%" cy="50%" r="50%">
            <stop offset="50%" stopColor="var(--color-accent-health)" stopOpacity="0" />
            <stop offset="100%" stopColor="var(--color-accent-health)" stopOpacity="0.45" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="96" fill="url(#morph-glow)" />
        <circle
          ref={ringRef}
          cx="100"
          cy="100"
          r="88"
          fill="none"
          stroke="var(--color-accent-health)"
          strokeWidth="4"
          opacity="0.55"
          style={{ filter: 'drop-shadow(0 0 10px var(--glow-health))' }}
        />
        <g ref={groupRef} style={{ transformOrigin: '100px 100px' }}>
          <path
            ref={pathRef}
            d={MORPH_SHAPES[0].d}
            fill={MORPH_SHAPES[0].color}
            stroke="rgb(255 255 255 / 0.25)"
            strokeWidth="1.5"
            style={{ color: MORPH_SHAPES[0].color, filter: 'drop-shadow(0 0 20px currentColor)' }}
          />
        </g>
      </svg>

      <div ref={wordmarkRef} className="flex flex-col items-center gap-[1.4vh]" style={{ opacity: 0 }}>
        <div className="flex items-center" style={{ fontFamily: 'var(--font-display)' }}>
          <span
            className="font-bold tracking-[0.14em]"
            style={{
              fontSize: 'clamp(28px, 6.5vh, 52px)',
              backgroundImage: 'linear-gradient(90deg, var(--color-accent-health), var(--color-accent-ai))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              filter: 'drop-shadow(0 0 18px rgb(0 229 160 / 0.35))',
            }}
          >
            NUTRI
          </span>
          <svg
            viewBox="0 0 100 100"
            style={{
              width: 'clamp(24px, 5.4vh, 42px)',
              height: 'clamp(24px, 5.4vh, 42px)',
              margin: '0 0.05em',
              filter: 'drop-shadow(0 0 12px var(--glow-health))',
            }}
          >
            <circle cx="50" cy="50" r="38" fill="none" stroke="var(--color-accent-health)" strokeWidth="13" />
          </svg>
          <span
            className="font-bold tracking-[0.14em]"
            style={{
              fontSize: 'clamp(28px, 6.5vh, 52px)',
              backgroundImage: 'linear-gradient(90deg, var(--color-accent-ai), var(--color-accent-warning))',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              filter: 'drop-shadow(0 0 18px rgb(139 92 246 / 0.35))',
            }}
          >
            S
          </span>
        </div>
        <span className="text-caption tracking-[0.3em] text-text-tertiary">EAT SMART · TRAIN HARD · TRACK REAL</span>
      </div>
    </div>
  )
}
