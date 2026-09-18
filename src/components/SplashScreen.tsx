import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { SPLASH_CATEGORIES } from '@/lib/splashCategories'

const INTRO_SEEN_KEY = 'nutrios.introSeen.v1'

const CATEGORY_ENTER = 0.45
const CATEGORY_HOLD = 1.35
const CATEGORY_EXIT = 0.3
const CATEGORY_BEAT = CATEGORY_ENTER + CATEGORY_HOLD + CATEGORY_EXIT

const WORDMARK_DURATION = 0.5
const HOLD_DURATION = 0.4
const IRIS_DURATION = 0.5

const PARTICLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

/**
 * Two versions of the same splash. First-ever open plays the full six-category tour — a real
 * feature tour (AI scan, meals, training, weigh-ins, progress, together mode), each icon from
 * lucide-react (a real professionally-drawn icon set, not hand-authored SVG paths) held on
 * screen long enough to actually read, with a particle burst and glow on arrival — matching the
 * dwell time of the reference this was modeled on rather than rushing through it. Every later
 * open plays a short ~1.6s version (straight to the wordmark) so the full tour doesn't become
 * something to sit through every single day.
 *
 * The splash stays fully opaque for its entire runtime. The real app is revealed exactly once,
 * in the final iris-wipe — never leaked through earlier via a see-through background.
 *
 * `finish()` is guarded so it only fires once, and a setTimeout watchdog calls it unconditionally
 * after the animation's own worst-case duration — the one guarantee that survives no matter what
 * happens to the GSAP/rAF-driven animation itself.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<(HTMLDivElement | null)[]>([])
  const particleRefs = useRef<(HTMLDivElement | null)[]>([])
  const dotRefs = useRef<(HTMLDivElement | null)[]>([])
  const wordmarkRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<SVGCircleElement>(null)

  useEffect(() => {
    const isFirstRun = !localStorage.getItem(INTRO_SEEN_KEY)
    try {
      localStorage.setItem(INTRO_SEEN_KEY, '1')
    } catch {
      // Private-browsing / storage-blocked: replay the full tour next time rather than crash.
    }

    const categoryTotal = isFirstRun ? SPLASH_CATEGORIES.length * CATEGORY_BEAT : 0
    const totalEstimateMs = (categoryTotal + WORDMARK_DURATION + HOLD_DURATION + IRIS_DURATION + 0.3) * 1000

    let done = false
    const finish = () => {
      if (done) return
      done = true
      onDone()
    }
    const watchdog = setTimeout(finish, totalEstimateMs + 2500)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      const t = setTimeout(finish, 500)
      return () => {
        clearTimeout(watchdog)
        clearTimeout(t)
      }
    }

    const tl = gsap.timeline({ onComplete: finish })

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

    tl.to(ringRef.current, { opacity: 1, strokeWidth: 8, duration: 0.3, ease: 'power2.out' })
      .fromTo(
        wordmarkRef.current,
        { opacity: 0, filter: 'blur(10px)', y: 8 },
        { opacity: 1, filter: 'blur(0px)', y: 0, duration: WORDMARK_DURATION, ease: 'power2.out' },
        '<',
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
            <circle
              ref={ringRef}
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke="var(--color-accent-health)"
              strokeWidth="4"
              opacity="0.55"
            />
          </svg>
          <span
            className="font-bold tracking-[0.14em]"
            style={{
              fontSize: 'clamp(28px, 6.5vh, 52px)',
              backgroundImage: 'linear-gradient(90deg, var(--color-accent-ai), var(--color-accent-energy))',
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
