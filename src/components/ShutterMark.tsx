/**
 * The real NUTRIOS mark, as actual SVG geometry (not a raster image) — a 6-blade camera iris,
 * same pinwheel shape the generated logo used, but built from real paths so the blades can
 * mechanically rotate open, exactly like a physical shutter. This is the one prerequisite the
 * whole cinematic splash sequence depends on: you can't mechanically animate a flat PNG.
 *
 * Each blade is identical geometry (computed once, see the header comment values below),
 * placed at 60° increments around the shared center. `bladeRotation` is the SAME extra
 * rotation applied to every blade around the SVG center (100,100) — animating it from a large
 * offset down to 0 makes the whole iris spin closed -> open as one motion, not six independent
 * ones, which reads as a real mechanism rather than six shapes doing their own thing.
 */
const BLADE_PATH = 'M 159.75 49.86 L 159.75 150.14 L 106.00 100.00 Z'
const BLADE_ANGLES = [0, 60, 120, 180, 240, 300]

export function ShutterMark({
  bladeRotation,
  size = 120,
  className,
}: {
  /** Degrees. 0 = fully open/rest position (matches the static logo). Positive values rotate
   * every blade further closed around the shared center. */
  bladeRotation: number
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="shutter-glow" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="var(--color-accent-health)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--color-accent-health)" stopOpacity="0.35" />
        </radialGradient>
        <linearGradient id="shutter-blade-fill" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="var(--color-accent-ai)" />
        </linearGradient>
      </defs>

      <circle cx="100" cy="100" r="92" fill="url(#shutter-glow)" />
      <circle
        cx="100"
        cy="100"
        r="88"
        fill="none"
        stroke="var(--color-accent-health)"
        strokeWidth="7"
        style={{ filter: 'drop-shadow(0 0 6px var(--glow-health))' }}
      />

      {BLADE_ANGLES.map((angle) => (
        <g key={angle} transform={`rotate(${angle + bladeRotation} 100 100)`}>
          <path d={BLADE_PATH} fill="url(#shutter-blade-fill)" stroke="#0a0a0f" strokeWidth="1" />
        </g>
      ))}
    </svg>
  )
}
