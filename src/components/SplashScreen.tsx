import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { SPLASH_CATEGORIES } from '@/lib/splashCategories'

const INTRO_SEEN_KEY = 'nutrios.introSeen.v1'

const CATEGORY_ENTER = 0.45
const CATEGORY_HOLD = 1.35
const CATEGORY_EXIT = 0.3
const CATEGORY_BEAT = CATEGORY_ENTER + CATEGORY_HOLD + CATEGORY_EXIT

const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

const WORDMARK_LETTERS = [
  { ch: 'N', color: '#00e5a0' },
  { ch: 'U', color: '#00d4c4' },
  { ch: 'T', color: '#10d8ff' },
  { ch: 'R', color: '#8b5cf6' },
  { ch: 'I', color: '#c040ff' },
]
const RING_COLOR = '#00e5a0'
const S_COLOR = '#ffb800'

const LETTER_ENTER = 0.45
const LETTER_STAGGER = 0.09
const WORDMARK_ENTER_TOTAL = LETTER_ENTER + LETTER_STAGGER * (WORDMARK_LETTERS.length + 1)
const HOLD_MS = 1300
const IRIS_DURATION = 0.5

/**
 * Two versions of the same splash. First-ever open plays the full six-category tour — a real
 * feature tour (AI scan, meals, training, weigh-ins, progress, together mode), each icon from
 * lucide-react held on screen long enough to actually read. Every later open plays a short
 * version straight to the wordmark, via a localStorage flag, so the full tour isn't something to
 * sit through daily.
 *
 * The wordmark itself is real kinetic typography: each letter pops in individually (scaled up,
 * staggered), settling together — not a single blurred block fading in at once.
 *
 * The hold-then-reveal at the end is DELIBERATELY its own timeline, started via a fresh
 * setTimeout only once the entrance animation genuinely finishes — not chained onto the same
 * GSAP timeline as everything before it. That matters: a GSAP timeline tracks real elapsed time,
 * so if the browser's render thread stalls even briefly (screen-recording overhead, a background
 * tab, a slow moment), the timeline "catches up" by jumping straight through every tween that
 * should already have finished — which is exactly what made the wordmark flash for a fraction of
 * a second and vanish on a real device recording. Anchoring the hold to a setTimeout scheduled
 * fresh at the real moment the entrance finishes guarantees it's actually visible for that long,
 * regardless of what happened earlier in the sequence.
 *
 * The splash must never be able to trap someone behind it. `finish()` is guarded so it only fires
 * once, and a plain `setTimeout` watchdog calls it unconditionally after the animation's own
 * worst-case duration as a last-resort guarantee.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<(HTMLDivElement | null)[]>([])
  const particleRefs = useRef<(HTMLDivElement | null)[]>([])
  const dotRefs = useRef<(HTMLDivElement | null)[]>([])
  const wordmarkRef = useRef<HTMLDivElement>(null)
  const letterRefs = useRef<(HTMLSpanElement | null)[]>([])
  const ringWrapRef = useRef<HTMLDivElement>(null)
  const sRef = useRef<HTMLSpanElement>(null)
  const taglineRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const isFirstRun = !localStorage.getItem(INTRO_SEEN_KEY)
    try {
      localStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {
      // Private-browsing / storage-blocked: replay the full tour next time rather than crash.
    }

    const categoryTotal = isFirstRun ? SPLASH_CATEGORIES.length * CATEGORY_BEAT : 0
    const totalEstimateMs = (categoryTotal + WORDMARK_ENTER_TOTAL) * 1000 + HOLD_MS + IRIS_DURATION * 1000

    let done = false
    const finish = () => {
      if (done) return
      done = true
      onDone()
    }
    const watchdog = setTimeout(finish, totalEstimateMs + 3000)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      const t = setTimeout(finish, 500)
      return () => {
        clearTimeout(watchdog)
        clearTimeout(t)
      }
    }

    const tl = gsap.timeline()

    if (isFirstRun) {
      SPLASH_CATEGORIES.forEach((cat, i) => {
        const el = categoryRefs.current[i]
        const dot = dotRefs.current[i]
        const particles = particleRefs.current.slice(i * 8, i * 8 + 8)

        tl.addLabel(`cat${i}`)
        tl.set(dot, { backgroundColor: cat.color, scale: 1.4 }, `cat${i}`)
        if (i > 0) tl.set(dotRefs.current[i - 1], { scale: 1, backgroundColor: 'rgb(255 255 255 / 0.25)' }, `cat${i}`)

        tl.fromTo(
          el,
          { opacity: 0, scale: 0.6, y: 10 },
          { opacity: 1, scale: 1, y: 0, duration: CATEGORY_ENTER, ease: 'back.out(1.8)' },
          `cat${i}`,
        )
        particles.forEach((p, pi) => {
          if (!p) return
          const angle = (PARTICLE_ANGLES[pi] * Math.PI) / 180
          const radius = 90
          gsap.set(p, { x: 0, y: 0, opacity: 1, scale: 1, backgroundColor: cat.color })
          tl.to(
            p,
            { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, opacity: 0, scale: 0.2, duration: 0.55, ease: 'power2.out' },
            '<',
          )
        })
        tl.to({}, { duration: CATEGORY_HOLD })
        tl.to(el, { opacity: 0, scale: 0.85, duration: CATEGORY_EXIT, ease: 'power1.in' })
      })
    }

    tl.set(wordmarkRef.current, { opacity: 1 })
    const popTargets = [...letterRefs.current, ringWrapRef.current, sRef.current]
    tl.fromTo(
      popTargets,
      { opacity: 0, scale: 2.6, y: 4 },
      { opacity: 1, scale: 1, y: 0, duration: LETTER_ENTER, ease: 'back.out(2.4)', stagger: LETTER_STAGGER },
    )
    tl.to(taglineRef.current, { opacity: 1, duration: 0.4, ease: 'power2.out' }, '-=0.2')

    tl.eventCallback('onComplete', () => {
      setTimeout(() => {
        gsap
          .timeline({ onComplete: finish })
          .to(rootRef.current, { clipPath: 'circle(0% at 50% 50%)', duration: IRIS_DURATION, ease: 'power3.in' })
      }, HOLD_MS)
    })

    return () => {
      clearTimeout(watchdog)
      tl.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once for the splash's one real lifecycle
  }, [])

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-bg-primary"
      style={{
        clipPath: 'circle(150% at 50% 50%)',
        backgroundImage:
          'radial-gradient(ellipse 70% 55% at 50% 42%, rgb(0 229 160 / 0.14) 0%, rgb(139 92 246 / 0.07) 45%, transparent 75%)',
      }}
    >
      <div className="relative flex h-[40vh] w-full items-center justify-center">
        {SPLASH_CATEGORIES.map((cat, i) => {
          const Icon = cat.Icon
          return (
            <div
              key={cat.id}
              ref={(el) => {
                categoryRefs.current[i] = el
              }}
              className="absolute flex flex-col items-center gap-[2vh]"
              style={{ opacity: 0 }}
            >
              <div className="relative flex items-center justify-center">
                {Array.from({ length: 8 }).map((_, pi) => (
                  <div
                    key={pi}
                    ref={(el) => {
                      particleRefs.current[i * 8 + pi] = el
                    }}
                    className="absolute h-1.5 w-1.5 rounded-full"
                    style={{ opacity: 0 }}
                  />
                ))}
                <Icon
                  style={{
                    width: 'clamp(120px, 20vh, 200px)',
                    height: 'clamp(120px, 20vh, 200px)',
                    color: cat.color,
                    filter: `drop-shadow(0 0 22px ${cat.color})`,
                  }}
                  strokeWidth={1.6}
                />
              </div>
              <span
                className="font-bold tracking-[0.25em]"
                style={{
                  fontSize: 'clamp(16px, 3.2vh, 24px)',
                  color: cat.color,
                  fontFamily: 'var(--font-display)',
                  filter: `drop-shadow(0 0 14px ${cat.color})`,
                }}
              >
                {cat.label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mb-[6vh] flex gap-2">
        {SPLASH_CATEGORIES.map((cat, i) => (
          <div
            key={cat.id}
            ref={(el) => {
              dotRefs.current[i] = el
            }}
            className="h-1.5 w-5 rounded-full"
            style={{ backgroundColor: 'rgb(255 255 255 / 0.25)' }}
          />
        ))}
      </div>

      <div className="absolute flex flex-col items-center gap-[1.4vh]" style={{ opacity: 0 }} ref={wordmarkRef}>
        <div className="flex items-center" style={{ fontFamily: 'var(--font-display)' }}>
          {WORDMARK_LETTERS.map((l, i) => (
            <span
              key={l.ch}
              ref={(el) => {
                letterRefs.current[i] = el
              }}
              className="inline-block font-bold tracking-[0.14em]"
              style={{
                fontSize: 'clamp(28px, 6.5vh, 52px)',
                color: l.color,
                filter: `drop-shadow(0 0 16px ${l.color})`,
                opacity: 0,
              }}
            >
              {l.ch}
            </span>
          ))}
          <div
            ref={ringWrapRef}
            className="inline-flex items-center justify-center"
            style={{ opacity: 0, margin: '0 0.05em' }}
          >
            <svg
              viewBox="0 0 100 100"
              style={{
                width: 'clamp(24px, 5.4vh, 42px)',
                height: 'clamp(24px, 5.4vh, 42px)',
                filter: `drop-shadow(0 0 14px ${RING_COLOR})`,
              }}
            >
              <circle cx="50" cy="50" r="38" fill="none" stroke={RING_COLOR} strokeWidth="9" />
            </svg>
          </div>
          <span
            ref={sRef}
            className="inline-block font-bold tracking-[0.14em]"
            style={{
              fontSize: 'clamp(28px, 6.5vh, 52px)',
              color: S_COLOR,
              filter: `drop-shadow(0 0 16px ${S_COLOR})`,
              opacity: 0,
            }}
          >
            S
          </span>
        </div>
        <span
          ref={taglineRef}
          className="text-caption tracking-[0.3em] text-text-tertiary"
          style={{ opacity: 0 }}
        >
          EAT SMART · TRAIN HARD · TRACK REAL
        </span>
      </div>
    </div>
  )
}
