import { useRef, useState } from 'react'
import { uploadAvatar, saveAvatarChoice } from '@/lib/avatarRepo'

/** Curated defaults, same visual family as togetherDemo.ts's DEMO_FRIENDS emoji avatars, so your
 * own row doesn't look out of place next to them until real multi-user identity exists. */
const DEFAULT_AVATARS = ['😊', '💪', '🔥', '🌱', '⚡', '🎯', '🦁', '🌟']

/** `avatar_url` doubles as either a real uploaded photo (an https:// URL) or a chosen emoji
 * default (a short string) — see avatarRepo.ts. This helper is the one place that distinction
 * is made, so callers just render whichever it is without needing to know the encoding. */
export function isPhotoAvatar(avatar: string | null): boolean {
  return !!avatar && avatar.startsWith('http')
}

export function AvatarPicker({
  userId,
  avatarUrl,
  onChange,
}: {
  userId: string
  avatarUrl: string | null
  onChange: (avatar: string) => void
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    try {
      const url = await uploadAvatar(file, userId)
      onChange(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <button
          onClick={() => fileInput.current?.click()}
          disabled={uploading}
          className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-bg-secondary text-3xl"
          aria-label="Change profile picture"
        >
          {uploading ? (
            <span className="text-caption text-text-tertiary">…</span>
          ) : isPhotoAvatar(avatarUrl) ? (
            <img src={avatarUrl!} alt="Your avatar" className="h-full w-full object-cover" />
          ) : (
            <span>{avatarUrl ?? '😊'}</span>
          )}
        </button>
        <div className="flex flex-col gap-1">
          <button onClick={() => fileInput.current?.click()} className="text-body text-accent-health">
            Upload photo
          </button>
          <span className="text-caption text-text-tertiary">Or pick one below</span>
        </div>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="text-caption text-accent-danger">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {DEFAULT_AVATARS.map((emoji) => (
          <button
            key={emoji}
            onClick={async () => {
              onChange(emoji)
              try {
                await saveAvatarChoice(userId, emoji)
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to save.')
              }
            }}
            className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl transition-colors ${
              avatarUrl === emoji ? 'border-accent-health bg-accent-health/10' : 'border-white/10 bg-bg-secondary'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
