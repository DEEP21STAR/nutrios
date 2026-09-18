/**
 * Original brand audio, synthesized directly via the Web Audio API rather than sourcing
 * third-party sound files — no licensing question, nothing to ship as an asset.
 *
 * Mobile browsers block audio that isn't tied to a user gesture. A top-level navigation the user
 * initiated (typing a URL, tapping a bookmark, reloading), or an in-app tap (the camera shutter,
 * confirming a log), grants enough activation for this to play, but it isn't guaranteed on every
 * browser/platform — every function here fails silently rather than throwing if audio is blocked.
 */
function newAudioContext(): AudioContext | null {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctor()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    return ctx
  } catch {
    return null
  }
}

function playNotes(ctx: AudioContext, notes: { freq: number; type?: OscillatorType }[], gap: number, duration: number, peakGain: number) {
  notes.forEach(({ freq, type }, i) => {
    const start = ctx.currentTime + i * gap
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type ?? 'sine'
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(peakGain, start + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(start)
    osc.stop(start + duration + 0.05)
  })
  setTimeout(() => ctx.close().catch(() => {}), (notes.length * gap + duration + 0.2) * 1000)
}

/** The splash's wordmark-reveal sting — a bright three-note ascending major arpeggio (C5-E5-G5). */
export function playBrandChime() {
  const ctx = newAudioContext()
  if (!ctx) return
  playNotes(
    ctx,
    [
      { freq: 523.25, type: 'sine' },
      { freq: 659.25, type: 'sine' },
      { freq: 783.99, type: 'triangle' },
    ],
    0.09,
    0.5,
    0.22,
  )
}

/** A quick two-note "ding" for frequent moments — food recognized, a meal logged. Short enough not to grate on repetition. */
export function playScanSuccessPing() {
  const ctx = newAudioContext()
  if (!ctx) return
  playNotes(
    ctx,
    [
      { freq: 783.99, type: 'sine' }, // G5
      { freq: 1046.5, type: 'triangle' }, // C6
    ],
    0.06,
    0.22,
    0.18,
  )
}
