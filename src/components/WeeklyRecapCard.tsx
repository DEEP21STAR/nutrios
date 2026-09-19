import { useRef, useState } from 'react'
import { X, Share2, Download } from 'lucide-react'
import type { DayVsGoal } from '@/lib/stats'
import { hapticTap } from '@/lib/haptics'

/**
 * Shareable weekly recap — the queued-but-unbuilt feature from the dashboard-elevation research
 * round (Spotify Wrapped/Strava-style share card, the pattern every competitor's growth loop
 * research converged on). Captured with html2canvas-pro (installed since the original stack
 * setup, never actually used until now) rather than recharts' own SVG output: recharts renders
 * through an SVG <foreignObject> in places, which html2canvas-pro can mis-render — this card
 * hand-rolls its own simple div/gradient bars specifically so what gets captured is exactly what
 * renders on screen, not a capture-library edge case.
 */
export function WeeklyRecapCard({
  data,
  name,
  onClose,
}: {
  data: DayVsGoal[]
  name?: string | null
  onClose: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const daysLogged = data.filter((d) => d.hasData).length
  const loggedDays = data.filter((d) => d.hasData)
  const avgCalories = loggedDays.length > 0 ? Math.round(loggedDays.reduce((sum, d) => sum + d.calories, 0) / loggedDays.length) : 0
  const goal = data[0]?.goal ?? 0
  const maxCalories = Math.max(goal, ...data.map((d) => d.calories), 1)
  const bestDay = loggedDays.reduce<DayVsGoal | null>((best, d) => {
    if (!best) return d
    return Math.abs(d.calories - d.goal) < Math.abs(best.calories - best.goal) ? d : best
  }, null)

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
      if (!blob) throw new Error('Could not generate the recap image.')
      const file = new File([blob], `nutryos-week-recap.png`, { type: 'image/png' })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My NUTRYOS week' })
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
      if (!blob) throw new Error('Could not generate the recap image.')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'nutryos-week-recap.png'
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
        className="flex w-full max-w-sm flex-col gap-5 rounded-3xl p-6"
        style={{
          background: 'radial-gradient(120% 100% at 20% 0%, rgb(139 92 246 / 0.25), transparent 60%), #0a0a0f',
          border: '1px solid rgb(255 255 255 / 0.08)',
        }}
      >
        <div>
          <p className="text-caption uppercase tracking-[0.25em] text-text-tertiary">
            {name?.trim() ? `${name.trim()}'s week` : 'My week'}
          </p>
          <p className="text-title text-text-primary">On NUTRYOS</p>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
            <p className="text-display text-accent-health">{daysLogged}/7</p>
            <p className="text-caption text-text-tertiary">days logged</p>
          </div>
          <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center">
            <p className="text-display text-accent-ai">{avgCalories || '—'}</p>
            <p className="text-caption text-text-tertiary">avg kcal/day</p>
          </div>
        </div>

        <div className="flex items-end gap-1.5" style={{ height: 90 }}>
          {data.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-md"
                style={{
                  height: `${Math.max(4, (d.calories / maxCalories) * 74)}px`,
                  background: d.hasData ? (d.calories > d.goal ? '#ff4757' : '#00e5a0') : 'rgb(255 255 255 / 0.08)',
                }}
              />
              <span className="text-[9px] uppercase text-text-tertiary">{d.dayLabel.slice(0, 1)}</span>
            </div>
          ))}
        </div>

        {bestDay && bestDay.hasData && (
          <p className="text-caption text-text-secondary">
            Closest to goal: <span className="text-text-primary">{bestDay.dayLabel}</span>
          </p>
        )}

        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <span className="text-caption font-semibold tracking-wide text-text-tertiary">NUTRYOS</span>
          <span className="text-caption text-text-tertiary">Eat Smart · Train Hard · Track Real</span>
        </div>
      </div>

      {error && <p className="text-caption text-accent-danger">{error}</p>}

      <div className="flex w-full max-w-sm gap-3">
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
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-health py-3 text-body font-semibold text-bg-primary disabled:opacity-50"
        >
          <Share2 size={16} /> {sharing ? 'Preparing…' : 'Share'}
        </button>
      </div>
    </div>
  )
}
