import { supabase } from '@/lib/supabase'
import { resizeForUpload } from '@/lib/imageResize'

const BUCKET = 'progress-photos'
const SIGNED_URL_TTL_S = 60 * 60 // 1 hour — plenty for a single viewing session

export type Pose = 'front' | 'side' | 'back'
export const POSES: Pose[] = ['front', 'side', 'back']

export interface ProgressPhoto {
  id: string
  takenAt: string
  weightKg: number | null
  note: string | null
  storagePath: string
  pose: Pose | null
}

/**
 * Unlike meal-photos (which persists a 7-day signed URL directly into the `meals` row — fine for
 * a photo that's mostly relevant the day it's taken), a progress-photo timeline is meant to stay
 * viewable for months or years. Persisting a signed URL would silently break every old photo
 * after 7 days. So this table only ever stores `storage_path` (permanent); every read mints a
 * fresh signed URL on demand instead.
 */
export async function uploadProgressPhoto(
  photo: Blob,
  userId: string,
  opts: { weightKg?: number; note?: string; pose?: Pose } = {},
): Promise<ProgressPhoto> {
  const { blob, mimeType, extension } = await resizeForUpload(photo, 1080)
  const path = `${userId}/${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mimeType,
    upsert: false,
  })
  if (uploadError) throw new Error(`Progress photo upload failed: ${uploadError.message}`)

  const { data, error: insertError } = await supabase
    .from('progress_photos')
    .insert({
      user_id: userId,
      storage_path: path,
      weight_kg: opts.weightKg ?? null,
      note: opts.note ?? null,
      pose: opts.pose ?? null,
    })
    .select('id, taken_at, weight_kg, note, storage_path, pose')
    .single()
  if (insertError || !data) {
    // Clean up the orphaned upload rather than leaving a file with no row pointing at it.
    await supabase.storage.from(BUCKET).remove([path])
    throw new Error(`Failed to save progress photo: ${insertError?.message ?? 'no data'}`)
  }

  return {
    id: data.id,
    takenAt: data.taken_at,
    weightKg: data.weight_kg,
    note: data.note,
    storagePath: data.storage_path,
    pose: data.pose,
  }
}

export async function listProgressPhotos(userId: string): Promise<ProgressPhoto[]> {
  const { data, error } = await supabase
    .from('progress_photos')
    .select('id, taken_at, weight_kg, note, storage_path, pose')
    .eq('user_id', userId)
    .order('taken_at', { ascending: false })
  if (error) throw new Error(`Failed to load progress photos: ${error.message}`)
  return (data ?? []).map((row) => ({
    id: row.id,
    takenAt: row.taken_at,
    weightKg: row.weight_kg,
    note: row.note,
    storagePath: row.storage_path,
    pose: row.pose,
  }))
}

/** Fresh signed URL for one photo's storage_path — never persisted, always minted on demand. */
export async function getProgressPhotoUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_S)
  if (error || !data) throw new Error(`Failed to sign progress photo URL: ${error?.message ?? 'no data'}`)
  return data.signedUrl
}

export async function deleteProgressPhoto(photo: ProgressPhoto, userId: string): Promise<void> {
  const { error: dbError } = await supabase.from('progress_photos').delete().eq('id', photo.id).eq('user_id', userId)
  if (dbError) throw new Error(`Failed to delete progress photo: ${dbError.message}`)
  await supabase.storage.from(BUCKET).remove([photo.storagePath])
}
