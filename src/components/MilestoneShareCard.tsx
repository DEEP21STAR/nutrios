import { useRef, useState } from 'react'
import { X, Share2, Download } from 'lucide-react'
import { hapticTap } from '@/lib/haptics'

/**
 * Generic shareable milestone card — the same capture/share/download mechanics
 * WeeklyRecapCard.tsx already proved (html2canvas-pro over recharts' own SVG output, Web Share
 * API with a download fallback), pulled out so an achievement unlock, a streak count, or a
 * workout burn can all reuse one component instead of three copies of the same capture logic.
 * Shaped close to an Instagram Story (9:16) since that's the real, proven "free growth" pattern
 * this was built for — Duolingo/Strava/Spotify-Wrapped-style share cards, not real social-network
 * API integration (see the research this was scoped from).
 */
export function MilestoneShareCard({
  eyebrow,
  headline,
  bigNumber,
  bigNumberLabel,
  icon,
  accentColor,
  name,
  onClose,
}: {
  eyebrow: string
  headline: string
  bigNumber: string | number
  bigNumberLabel: string
  icon: string
  accentColor: string
  name?: string | null
  onClose: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function captureCard(): Promise<Blob | null> {
    if (!cardRef.current) return null
    const html2canvas = (await import('html2canvas-pro')).default
    const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2 })
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'))
  }

  async function handleShare() {
    hapticTap()
    setSharing(true)
    setError(null)
    try {
      const blob = await captureCard()
      if (!blob) throw new Error('Could not generate the share image.')
      const file = new File([blob], 'nutryos-milestone.png', { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My NUTRYOS milestone' })
      } else {
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') setError(err.message)
    } finally {
      setSharing(false)
    }
  }

  async function handleDownload() {
    hapticTap()
    setSharing(true)
    setError(null)
    try {
      const blob = await captureCard()
      if (!blob) throw new Error('Could not generate the share image.')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'nutryos-milestone.png'
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-black/80 p-5 backdrop-blur-sm">
      <button onClick={onClose} aria-label="Close" className="absolute right-5 top-[calc(env(safe-area-inset-top,0px)+16px)] text-text-tertiary">
        <X size={24} />
      </button>

      <div
        ref={cardRef}
        className="flex aspect-[9/16] w-full max-w-[260px] flex-col items-center justify-center gap-6 rounded-3xl p-8 text-center"
        style={{
          background: `radial-gradient(120% 90% at 50% 0%, ${accentColor}33, transparent 65%), #0a0a0f`,
          border: '1px solid rgb(255 255 255 / 0.08)',
        }}
      >
        <p className="text-caption uppercase tracking-[0.3em] text-text-tertiary">
          {name?.trim() ? `${name.trim()} on NUTRYOS` : 'On NUTRYOS'}
        </p>

        <span className="text-6xl" aria-hidden style={{ filter: `drop-shadow(0 0 24px ${accentColor})` }}>
          {icon}
        </span>

        <div>
          <p className="text-display font-bold" style={{ color: accentColor, textShadow: `0 0 20px ${accentColor}99` }}>
            {bigNumber}
          </p>
          <p className="text-caption text-text-tertiary">{bigNumberLabel}</p>
        </div>

        <p className="text-subtitle text-text-primary">{headline}</p>
        <p className="text-caption uppercase tracking-[0.2em] text-text-tertiary">{eyebrow}</p>

        <div className="mt-2 border-t border-white/10 pt-3">
          <span className="text-caption font-semibold tracking-wide text-text-tertiary">NUTRYOS</span>
        </div>
      </div>

      {error && <p className="text-caption text-accent-danger">{error}</p>}

      <div className="flex w-full max-w-[260px] gap-3">
        <button
          onClick={handleDownload}
          disabled={sharing}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-bg-secondary py-3 text-body text-text-secondary disabled:opacity-50"
        >
          <Download size={16} /> Save
        </button>
        <button
          onClick={handleShare}
          disabled={sharing}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-body font-semibold text-bg-primary disabled:opacity-50"
          style={{ background: accentColor }}
        >
          <Share2 size={16} /> {sharing ? 'Preparing…' : 'Share'}
        </button>
      </div>
    </div>
  )
}
