import { useState } from 'react'
import { applyTheme, type Theme } from '@/lib/theme'
import { AvatarPicker } from '@/components/AvatarPicker'

interface SettingsPanelProps {
  onClose: () => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
  needRefresh: boolean
  onUpdate: () => void
  onCheckForUpdates: () => Promise<boolean>
  userId: string | null
  avatarUrl: string | null
  onAvatarChange: (avatar: string) => void
}

/**
 * Full-screen Settings — theme choice, build identity, and a real update check. The build
 * number/hash are injected at build time by vite.config.ts's `define` (real git commit count +
 * short hash), never hand-typed, so this can't silently go stale like a manually bumped version
 * string would.
 */
export function SettingsPanel({
  onClose,
  theme,
  onThemeChange,
  needRefresh,
  onUpdate,
  onCheckForUpdates,
  userId,
  avatarUrl,
  onAvatarChange,
}: SettingsPanelProps) {
  const [checkState, setCheckState] = useState<'idle' | 'checking' | 'up-to-date'>('idle')

  async function handleCheck() {
    setCheckState('checking')
    const found = await onCheckForUpdates()
    setCheckState(found ? 'idle' : 'up-to-date')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg-primary text-text-primary">
      <div className="glass sticky top-0 z-10 flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3">
        <button onClick={onClose} className="text-caption text-text-tertiary">
          Close
        </button>
        <h2 className="text-caption uppercase tracking-wide text-text-secondary">Settings</h2>
        <div className="w-12" />
      </div>

      <div className="mx-4 mt-6 flex flex-col gap-4">
        {userId && (
          <section className="glass-card flex flex-col gap-3 p-4">
            <h3 className="text-body font-semibold">Profile</h3>
            <AvatarPicker userId={userId} avatarUrl={avatarUrl} onChange={onAvatarChange} />
          </section>
        )}

        <section className="glass-card flex flex-col gap-3 p-4">
          <h3 className="text-body font-semibold">Appearance</h3>
          <div className="grid grid-cols-2 gap-3">
            {(['dark', 'light'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  applyTheme(opt)
                  onThemeChange(opt)
                }}
                className={`rounded-xl border px-4 py-3 text-body capitalize transition-colors ${
                  theme === opt
                    ? 'border-accent-health bg-accent-health/10 text-text-primary'
                    : 'border-white/10 bg-bg-secondary text-text-secondary'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </section>

        <section className="glass-card flex flex-col gap-3 p-4">
          <h3 className="text-body font-semibold">About</h3>
          <div className="flex items-center justify-between">
            <span className="text-caption text-text-tertiary">Build</span>
            <span className="text-caption text-text-secondary">
              #{__BUILD_NUMBER__} · {__COMMIT_HASH__}
            </span>
          </div>

          {needRefresh ? (
            <button onClick={onUpdate} className="rounded-xl bg-accent-health py-3 text-body font-semibold text-bg-primary">
              Update available — tap to reload
            </button>
          ) : (
            <button
              onClick={handleCheck}
              disabled={checkState === 'checking'}
              className="rounded-xl border border-white/10 bg-bg-secondary py-3 text-body text-text-secondary disabled:opacity-60"
            >
              {checkState === 'checking'
                ? 'Checking…'
                : checkState === 'up-to-date'
                  ? "You're up to date"
                  : 'Check for updates'}
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
