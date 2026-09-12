/**
 * Client-side resize/compress, used both before sending a photo to the vision
 * model (smaller image = fewer vision tokens = meaningfully faster inference
 * — confirmed live: a 700x582 original vs a 640x640 resize measurably
 * changed inference behavior during core-loop testing) and before any future
 * Supabase Storage upload (spec calls for ~1080px WebP there specifically).
 */
export function resizeImage(blob: Blob, maxDimension: number, mimeType = 'image/jpeg', quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'))
        return
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(
        (out) => (out ? resolve(out) : reject(new Error('Canvas toBlob failed'))),
        mimeType,
        quality,
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image for resize'))
    }
    img.src = url
  })
}

/**
 * Resize + compress specifically for Supabase Storage upload (~1080px WebP,
 * per spec, to stay well within the free 1GB bucket).
 *
 * REAL PLATFORM GAP, verified live via research rather than assumed: iOS
 * Safari's `canvas.toBlob('image/webp')` does NOT support WebP ENCODING (it
 * can decode/display WebP fine, just not produce it from canvas) — it
 * silently returns a PNG instead, with no error. An uncompressed PNG photo
 * would burn through the free storage tier far faster than the ~1080px WebP
 * the spec calls for, so this checks the actual returned blob's `.type` and
 * falls back to JPEG (universal encode support, much smaller than PNG for a
 * photo) whenever the browser didn't actually give us WebP. Callers get the
 * real mime type back so the storage path/extension matches what was
 * actually produced — this platform difference is surfaced, not hidden.
 */
export async function resizeForUpload(
  blob: Blob,
  maxDimension = 1080,
): Promise<{ blob: Blob; mimeType: 'image/webp' | 'image/jpeg'; extension: 'webp' | 'jpg' }> {
  const webp = await resizeImage(blob, maxDimension, 'image/webp', 0.85)
  if (webp.type === 'image/webp') {
    return { blob: webp, mimeType: 'image/webp', extension: 'webp' }
  }
  // Browser (e.g. iOS Safari) silently gave us something else — re-encode as
  // JPEG instead of accepting an oversized PNG.
  const jpeg = await resizeImage(blob, maxDimension, 'image/jpeg', 0.85)
  return { blob: jpeg, mimeType: 'image/jpeg', extension: 'jpg' }
}
