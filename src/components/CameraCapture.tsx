import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Core-loop step 1: camera capture. Uses a real `getUserMedia` live preview
 * (per spec) with an in-browser shutter button. Falls back to a native
 * `<input type="file" accept="image/*" capture="environment">` picker when
 * `getUserMedia` is unavailable or permission is denied — this is a REAL,
 * common failure mode (desktop browsers with no camera, iOS Safari camera
 * permission denied in a PWA context, etc.), not a hypothetical, so the
 * fallback is a first-class path rather than an error dead-end.
 */
export function CameraCapture({
  onCapture,
  onCancel,
}: {
  onCapture: (photo: Blob) => void
  onCancel: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    // Real gap found during testing (no-camera environment): getUserMedia can
    // simply never resolve or reject at all — no error event ever fires,
    // leaving the user stuck on a permanently disabled shutter with only
    // Cancel to escape. A hard timeout guarantees the file-input fallback is
    // always reachable, not just on an explicit permission/NotFound error.
    const stallTimer = setTimeout(() => {
      if (!cancelled) setError((prev) => prev ?? 'timeout')
    }, 6000)
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('no-getUserMedia')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1080 }, height: { ideal: 1080 } },
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
      } catch (err) {
        clearTimeout(stallTimer)
        setError(err instanceof Error ? err.name : 'unknown')
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
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob)
      },
      'image/jpeg',
      0.9,
    )
  }

  function handleFileFallback(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onCapture(file)
  }

  const useFallback = error != null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {useFallback ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center text-slate-200">
          <p className="text-sm text-slate-400">
            {error === 'no-getUserMedia'
              ? 'Live camera preview is not available in this browser.'
              : error === 'timeout'
                ? 'Camera preview is taking too long to start.'
                : 'Camera permission was denied or no camera was found.'}
          </p>
          <label className="cursor-pointer rounded-full bg-emerald-500 px-6 py-3 font-semibold text-slate-900">
            Choose / take a photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileFallback} />
          </label>
          <button onClick={onCancel} className="text-sm text-slate-400 underline">
            Cancel
          </button>
        </div>
      ) : (
        <>
          <video ref={videoRef} playsInline muted className="h-full w-full flex-1 object-cover" />
          <div className="absolute inset-x-0 top-0 flex justify-between p-4">
            <button onClick={onCancel} className="rounded-full bg-black/50 px-4 py-2 text-sm text-white">
              Cancel
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex justify-center pb-10">
            <button
              onClick={shoot}
              disabled={!ready}
              className={cn(
                'h-20 w-20 rounded-full border-4 border-white bg-white/20 transition',
                ready ? 'active:scale-90' : 'opacity-40',
              )}
              aria-label="Take photo"
            />
          </div>
        </>
      )}
    </div>
  )
}
