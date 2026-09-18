import confetti from 'canvas-confetti'

const PALETTE = ['#22d3ee', '#a855f7', '#ec4899', '#34d399', '#f59e0b']

/** Standard celebration burst — debt paid off, funds back to positive, streak milestones. */
export function fireConfetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 }, colors: PALETTE, scalar: 0.9 })
  confetti({ particleCount: 50, spread: 100, origin: { y: 0.6 }, colors: PALETTE, scalar: 1.2, startVelocity: 45 })
}

/** Bigger burst for the largest moments (debt fully paid off). */
export function fireBigConfetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const end = Date.now() + 700
  const frame = () => {
    confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 }, colors: PALETTE })
    confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 }, colors: PALETTE })
    if (Date.now() < end) requestAnimationFrame(frame)
  }
  frame()
}

// ---------------------------------------------------------------------------
// Achievement-specific confetti SHAPES, not one generic burst for everything.
// Uses canvas-confetti's real shapeFromText() (real emoji-rendered particle
// shapes, not a fake/simulated effect) so a streak milestone genuinely looks
// different from a default badge unlock, not just a colour swap.
// ---------------------------------------------------------------------------

let flameShape: confetti.Shape | null = null

function getFlameShape(): confetti.Shape {
  return (flameShape ??= confetti.shapeFromText({ text: '🔥', scalar: 3 }))
}

/** Streak milestone (7/30/100 days) — flame shapes. */
export function fireStreakConfetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  confetti({ particleCount: 30, spread: 80, origin: { y: 0.5 }, shapes: [getFlameShape()], scalar: 1, startVelocity: 40 })
}

/** Hitting the exact calorie goal (the Bullseye badge) — target-ring shapes via emoji burst. */
export function fireBullseyeConfetti() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const shape = confetti.shapeFromText({ text: '🎯', scalar: 3 })
  confetti({ particleCount: 30, spread: 70, origin: { y: 0.5 }, shapes: [shape], scalar: 1 })
}
