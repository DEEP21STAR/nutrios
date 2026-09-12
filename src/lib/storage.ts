import { supabase } from '@/lib/supabase'
import { resizeForUpload } from '@/lib/imageResize'

const BUCKET = 'meal-photos'

/**
 * Uploads a meal photo to the private `meal-photos` bucket, compressed/
 * resized client-side first (~1080px, WebP where the browser can actually
 * encode it — see resizeForUpload's iOS Safari fallback). Path is
 * `<userId>/<uuid>.<ext>` to match the storage RLS policies in
 * supabase/migrations/0001_init.sql, which check
 * `(storage.foldername(name))[1] = auth.uid()`.
 *
 * The bucket is PRIVATE (not public) — returns a signed URL (7-day expiry)
 * rather than a permanent public link, since these are personal meal photos.
 */
export async function uploadMealPhoto(photo: Blob, userId: string): Promise<string> {
  const { blob, mimeType, extension } = await resizeForUpload(photo, 1080)
  const path = `${userId}/${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mimeType,
    upsert: false,
  })
  if (uploadError) throw new Error(`Meal photo upload failed: ${uploadError.message}`)

  const { data, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7)
  if (signError || !data) throw new Error(`Failed to create signed URL: ${signError?.message ?? 'no data'}`)

  return data.signedUrl
}
