import { supabase } from '@/lib/supabase'
import { resizeForUpload } from '@/lib/imageResize'

const BUCKET = 'avatars'

/**
 * Real Supabase-backed profile avatar. Unlike meal-photos (private, signed URLs), the `avatars`
 * bucket is PUBLIC — an avatar is meant to eventually be visible to other people in Together
 * Mode once real multi-user identity exists (see togetherDemo.ts's own header comment on why
 * that's not built yet), so a plain permanent public URL is the correct fit, not a 7-day signed
 * one that would silently expire.
 */
export async function uploadAvatar(photo: Blob, userId: string): Promise<string> {
  const { blob, mimeType, extension } = await resizeForUpload(photo, 512)
  const path = `${userId}/avatar.${extension}`

  // upsert: true — a user replacing their avatar should overwrite the same path, not accumulate
  // orphaned old files forever.
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: mimeType,
    upsert: true,
  })
  if (uploadError) throw new Error(`Avatar upload failed: ${uploadError.message}`)

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  // Cache-bust: same path every time (upsert), so without this the browser/CDN would keep
  // showing the OLD image after a re-upload until its cache happened to expire.
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`

  const { error: profileError } = await supabase.from('profiles').upsert({
    user_id: userId,
    avatar_url: publicUrl,
  })
  if (profileError) throw new Error(`Failed to save avatar to profile: ${profileError.message}`)

  return publicUrl
}

/** For the "pick a default emoji" path — same profiles.avatar_url column as uploadAvatar, just
 * storing a short emoji string instead of a photo URL (see AvatarPicker's isPhotoAvatar). */
export async function saveAvatarChoice(userId: string, emoji: string): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({ user_id: userId, avatar_url: emoji })
  if (error) throw new Error(`Failed to save avatar choice: ${error.message}`)
}

export async function fetchAvatarUrl(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('avatar_url').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(`Failed to load profile: ${error.message}`)
  return data?.avatar_url ?? null
}
