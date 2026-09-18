/**
 * Thin wrapper around the Vibration API. `navigator.vibrate` can throw on some
 * locked-down browsers (matches the existing precedent in ConfirmLog.tsx) and is
 * entirely absent on desktop — every call here is a no-op there, never an error.
 */
function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    // no-op
  }
}

/** A light tap — selection, a toggle, the camera shutter. */
export function hapticTap() {
  vibrate(8)
}

/** A short success buzz — food recognized, meal logged. */
export function hapticSuccess() {
  vibrate([12, 40, 12])
}

/** A bigger pattern for the largest moments — achievement unlocked, goal hit. */
export function hapticCelebrate() {
  vibrate([15, 50, 15, 50, 25])
}
