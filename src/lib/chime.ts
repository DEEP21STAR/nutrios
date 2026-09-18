/**
 * A short original brand sting for the splash's wordmark reveal — a bright three-note ascending
 * major arpeggio (C5-E5-G5), synthesized directly via the Web Audio API rather than sourcing a
 * third-party sound file, so there's no licensing question and no asset to ship.
 *
 * Mobile browsers block audio that isn't tied to a user gesture. A top-level navigation the user
 * initiated (typing a URL, tapping a bookmark, reloading) usually grants enough activation for
 * this to play, but it isn't guaranteed on every browser/platform — this fails silently rather
 * than throwing if the AudioContext stays suspended.
 */
export function playBrandChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {})
    }

    const notes = [523.25, 659.25, 783.99] // C5, E5, G5
    const noteGap = 0.09
    const noteDuration = 0.5

    notes.forEach((freq, i) => {
      const start = ctx.currentTime + i * noteGap
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = i === notes.length - 1 ? 'triangle' : 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + noteDuration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + noteDuration + 0.05)
    })

    setTimeout(() => ctx.close().catch(() => {}), (notes.length * noteGap + noteDuration + 0.2) * 1000)
  } catch {
    // Web Audio unavailable or blocked -- the splash still works without sound.
  }
}
