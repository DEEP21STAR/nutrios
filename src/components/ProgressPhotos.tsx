import { useEffect, useRef, useState } from 'react'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { hapticSuccess, hapticTap } from '@/lib/haptics'
import { playScanSuccessPing } from '@/lib/chime'
import { isPremiumUnlocked } from '@/lib/premium'
import {
  deleteProgressPhoto,
  getProgressPhotoUrl,
  listProgressPhotos,
  uploadProgressPhoto,
  type ProgressPhoto,
} from '@/lib/progressPhotosRepo'

/** Free tier sees the most recent 10 (still fully uploaded/stored either way — this only caps
 * what's shown, never what's kept, so upgrading later restores full history instantly rather
 * than needing to re-upload anything). */
const FREE_PHOTO_LIMIT = 10

/**
 * Progress photos — the one genuinely new feature from Deep's "elevate everything" research
 * pass. Private by default (see the migration's own header comment): nothing here is visible to
 * anyone else automatically. Sharing is one explicit action per photo via the native share
 * sheet, matching how every real progress-photo app researched handles it.
 *
 * The capture screen overlays the most recent photo at low opacity as an alignment guide (real
 * pose-matching/computer-vision alignment is a much bigger lift — this is the honest, achievable
 * version of "line up your shot with last time" for this pass).
 */
export function ProgressPhotos({ userId, onOpenSettings }: { userId: string; onOpenSettings: () => void }) {
  const [photos, setPhotos] = useState<ProgressPhoto[] | null>(null)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null)
  const [compareMode, setCompareMode] = useState(false)
  const [compareIds, setCompareIds] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const list = await listProgressPhotos(userId)
        if (cancelled) return
        setPhotos(list)
        const entries = await Promise.all(list.map(async (p) => [p.id, await getProgressPhotoUrl(p.storagePath)] as const))
        if (cancelled) return
        setUrls(Object.fromEntries(entries))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load progress photos.')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  const premium = isPremiumUnlocked()
  const visiblePhotos = photos === null ? [] : premium ? photos : photos.slice(0, FREE_PHOTO_LIMIT)
  const hiddenCount = photos === null || premium ? 0 : Math.max(0, photos.length - FREE_PHOTO_LIMIT)

  async function handleCaptured(blob: Blob) {
    setCapturing(false)
    try {
      const saved = await uploadProgressPhoto(blob, userId)
      const url = await getProgressPhotoUrl(saved.storagePath)
      setPhotos((prev) => [saved, ...(prev ?? [])])
      setUrls((prev) => ({ ...prev, [saved.id]: url }))
      playScanSuccessPing()
      hapticSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save progress photo.')
    }
  }

  async function handleDelete(photo: ProgressPhoto) {
    try {
      await deleteProgressPhoto(photo, userId)
      setPhotos((prev) => (prev ?? []).filter((p) => p.id !== photo.id))
      setViewing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete progress photo.')
    }
  }

  async function handleShare(photo: ProgressPhoto) {
    const url = urls[photo.id]
    if (!url) return
    try {
      const blob = await fetch(url).then((r) => r.blob())
      const file = new File([blob], `nutryos-progress-${photo.takenAt.slice(0, 10)}.jpg`, { type: blob.type })
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My NUTRYOS progress' })
      } else {
        // No Web Share support (most desktop browsers) — open it in a new tab so Deep can
        // still save/send it manually, rather than failing silently.
        window.open(url, '_blank')
      }
    } catch (err) {
      // AbortError is the user just cancelling the native share sheet — not a real error.
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message)
      }
    }
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 2) return [prev[1], id]
      return [...prev, id]
    })
  }

  const comparePhotos = compareIds.map((id) => photos?.find((p) => p.id === id)).filter((p): p is ProgressPhoto => !!p)

  return (
    <section className="mt-6 px-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-subtitle text-text-primary">Progress Photos</h2>
        <div className="flex gap-2">
          {(photos?.length ?? 0) >= 2 && (
            <button
              onClick={() => {
                setCompareMode((v) => !v)
                setCompareIds([])
              }}
              className={cn(
                'rounded-full px-3 py-1 text-caption',
                compareMode ? 'bg-accent-ai text-bg-primary' : 'glass text-text-secondary',
              )}
            >
              Compare
            </button>
          )}
          <button
            onClick={() => {
              hapticTap()
              setCapturing(true)
            }}
            className="glass rounded-full px-3 py-1 text-caption text-accent-health shadow-[0_0_12px_1px_var(--glow-health)]"
          >
            + Add photo
          </button>
        </div>
      </div>

      {error && <p className="mb-2 text-caption text-accent-danger">{error}</p>}

      {compareMode && comparePhotos.length === 2 ? (
        <CompareSlider
          before={comparePhotos[1]}
          after={comparePhotos[0]}
          beforeUrl={urls[comparePhotos[1].id]}
          afterUrl={urls[comparePhotos[0].id]}
        />
      ) : compareMode ? (
        <p className="py-6 text-center text-caption text-text-tertiary">Pick 2 photos below to compare.</p>
      ) : null}

      {photos === null ? (
        <p className="py-4 text-center text-caption text-text-tertiary">Loading…</p>
      ) : photos.length === 0 ? (
        <p className="py-4 text-center text-caption text-text-tertiary">
          No progress photos yet — private to you until you choose to share one.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {visiblePhotos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => (compareMode ? toggleCompare(photo.id) : setViewing(photo))}
                className={cn(
                  'relative aspect-square overflow-hidden rounded-lg bg-bg-secondary',
                  compareMode && compareIds.includes(photo.id) && 'ring-2 ring-accent-ai',
                )}
              >
                {urls[photo.id] && <img src={urls[photo.id]} alt="" className="h-full w-full object-cover" />}
                <span className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-[10px] text-white">
                  {photo.takenAt.slice(0, 10)}
                </span>
              </button>
            ))}
          </div>
          {hiddenCount > 0 && (
            <button
              onClick={onOpenSettings}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-accent-energy/40 bg-accent-energy/5 py-3 text-caption text-accent-energy"
            >
              <Lock size={14} /> {hiddenCount} older photo{hiddenCount === 1 ? '' : 's'} — Premium unlocks full history
            </button>
          )}
        </>
      )}

      {capturing && <ProgressPhotoCapture guideUrl={urls[photos?.[0]?.id ?? '']} onCapture={handleCaptured} onCancel={() => setCapturing(false)} />}

      {viewing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg-primary/95 p-6">
          <img src={urls[viewing.id]} alt="" className="max-h-[60vh] w-full rounded-xl object-contain" />
          <p className="text-caption text-text-tertiary">{viewing.takenAt.slice(0, 10)}</p>
          <div className="flex gap-3">
            <button onClick={() => handleShare(viewing)} className="glass rounded-full px-5 py-2 text-caption text-accent-ai">
              Share
            </button>
            <button onClick={() => handleDelete(viewing)} className="glass rounded-full px-5 py-2 text-caption text-accent-danger">
              Delete
            </button>
            <button onClick={() => setViewing(null)} className="glass rounded-full px-5 py-2 text-caption text-text-secondary">
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

/** Real getUserMedia capture, same fallback discipline as CameraCapture.tsx (a hard timeout so a
 * stalled permission prompt can't strand someone with a dead shutter) — but no AI identify step,
 * this just captures and saves. */
function ProgressPhotoCapture({
  guideUrl,
  onCapture,
  onCancel,
}: {
  guideUrl?: string
  onCapture: (blob: Blob) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const stallTimer = setTimeout(() => {
      if (!cancelled) setError(true)
    }, 6000)
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(true)
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        clearTimeout(stallTimer)
        setReady(true)
      } catch {
        clearTimeout(stallTimer)
        setError(true)
      }
    }
    start()
    return () => {
      cancelled = true
      clearTimeout(stallTimer)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function shoot() {
    hapticTap()
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => blob && onCapture(blob), 'image/jpeg', 0.9)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onCapture(file)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-bg-primary">
      {error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-body text-text-secondary">Live camera preview isn't available — you can still upload a photo.</p>
          <label className="glass cursor-pointer rounded-full px-6 py-3 text-subtitle font-semibold text-accent-health">
            Choose a photo
            <input type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />
          </label>
          <button onClick={onCancel} className="text-caption text-text-tertiary underline">
            Cancel
          </button>
        </div>
      ) : (
        <>
          <video ref={videoRef} playsInline muted className="h-full w-full flex-1 object-cover" />
          {guideUrl && (
            <img
              src={guideUrl}
              alt=""
              aria-hidden
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-luminosity"
            />
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
            <button onClick={onCancel} className="glass rounded-full px-4 py-2 text-caption text-text-primary">
              Cancel
            </button>
            {guideUrl && (
              <span className="glass rounded-full px-3 py-1 text-caption text-accent-ai">Ghost = your last photo</span>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-10">
            <button
              onClick={shoot}
              disabled={!ready}
              className={cn(
                'h-20 w-20 rounded-full border-4 border-white/90 bg-white/10 backdrop-blur-sm transition',
                ready ? 'active:scale-90 shadow-[0_0_32px_6px_var(--glow-health)]' : 'opacity-40',
              )}
              aria-label="Take photo"
            />
          </div>
        </>
      )}
    </div>
  )
}

/** Draggable before/after slider — the standard technique every real progress-photo app uses:
 * two stacked images, the "after" one clipped via clip-path controlled by a range input. */
function CompareSlider({
  before,
  after,
  beforeUrl,
  afterUrl,
}: {
  before: ProgressPhoto
  after: ProgressPhoto
  beforeUrl?: string
  afterUrl?: string
}) {
  const [pct, setPct] = useState(50)
  return (
    <div className="mb-3">
      <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-bg-secondary">
        {beforeUrl && <img src={beforeUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />}
        {afterUrl && (
          <img
            src={afterUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
          />
        )}
        <div
          aria-hidden
          className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_2px_rgba(255,255,255,0.6)]"
          style={{ left: `${pct}%` }}
        />
        <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white">
          {after.takenAt.slice(0, 10)}
        </span>
        <span className="absolute bottom-2 right-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-white">
          {before.takenAt.slice(0, 10)}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        className="mt-2 w-full"
        aria-label="Comparison slider"
      />
    </div>
  )
}
