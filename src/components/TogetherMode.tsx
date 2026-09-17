import { useMemo, useState } from 'react'
import type { Goals, Meal } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  buildLeaderboard,
  CHALLENGES,
  loadTogetherSettings,
  saveTogetherSettings,
  type ChallengeType,
  type LeaderboardEntry,
  type ShareLevel,
} from '@/lib/togetherDemo'

const PODIUM_COLORS = ['#ffd700', '#c0c0c0', '#cd7f32'] // gold, silver, bronze

/**
 * Together Mode (Phase 4) — friends/family leaderboard + podium.
 *
 * HONEST LABELING, not buried in a comment: this app has no real friend/social backend (see
 * togetherDemo.ts's header comment for the full reasoning — anonymous Supabase auth, no named
 * identity, no invite system). This screen is a real, working PREVIEW: the challenge math, the
 * podium, and the privacy-tier setting are all genuinely functional, but every "friend" row is
 * fixed sample data, visibly tagged "(demo)" in its name AND in a persistent "PREVIEW" badge next
 * to the section title — never presented as if it were real multi-user data. Only YOUR row
 * (bottom of the DEMO_FRIENDS list in togetherDemo.ts, tagged isYou/isDemo:false) is computed
 * from your real logged meals.
 */
export function TogetherMode({ meals, goals }: { meals: Meal[]; goals: Goals }) {
  const [settings, setSettings] = useState(loadTogetherSettings)
  const [challenge, setChallenge] = useState<ChallengeType>('consistency')
  const [bannerDismissed, setBannerDismissed] = useState(false)

  const leaderboard = useMemo(
    () => buildLeaderboard(challenge, meals, goals, settings.displayName),
    [challenge, meals, goals, settings.displayName],
  )

  const visibleLeaderboard =
    settings.shareLevel === 'none' ? leaderboard.filter((e) => !e.isYou) : leaderboard

  function updateSettings(patch: Partial<typeof settings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveTogetherSettings(next)
  }

  const challengeMeta = CHALLENGES.find((c) => c.id === challenge)!
  const podium = visibleLeaderboard.slice(0, 3)
  const rest = visibleLeaderboard.slice(3)

  return (
    <section className="mt-6 px-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-subtitle text-text-primary">Together Mode</h2>
        <span className="rounded-full bg-accent-energy/15 px-2 py-0.5 text-caption font-semibold text-accent-energy ring-1 ring-accent-energy/30">
          PREVIEW
        </span>
      </div>

      {!bannerDismissed && (
        <div className="glass-card mb-3 flex flex-col gap-1.5 p-3 text-caption text-text-secondary">
          <p>
            <strong className="text-accent-energy">This is a preview.</strong> Friend connections and a real shared
            leaderboard aren't built yet. Every row below tagged <em>(demo)</em> is fixed sample data — only your own
            row is computed from your real logged meals.
          </p>
          <button
            onClick={() => setBannerDismissed(true)}
            className="self-start text-caption text-text-tertiary underline"
          >
            Got it
          </button>
        </div>
      )}

      {/* Challenge tabs */}
      <div className="mb-3 flex gap-2">
        {CHALLENGES.map((c) => (
          <button
            key={c.id}
            onClick={() => setChallenge(c.id)}
            className={cn(
              'glass flex-1 rounded-full px-2 py-2 text-caption font-semibold transition',
              challenge === c.id ? 'text-accent-ai shadow-[0_0_16px_2px_var(--glow-ai)]' : 'text-text-tertiary',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="mb-3 text-caption text-text-tertiary">{challengeMeta.description}</p>

      {settings.shareLevel === 'none' ? (
        <div className="glass-card p-4 text-center text-caption text-text-tertiary">
          You're set to <strong className="text-text-secondary">No one</strong> — your row is hidden from this
          preview. Real sharing isn't wired up yet, but your setting is already respected.
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="mb-3 flex items-end justify-center gap-3">
            {podium.map((entry, i) => (
              <PodiumSlot key={entry.id} entry={entry} rank={i + 1} unit={challengeMeta.unit} />
            ))}
          </div>

          {/* Full list below the podium */}
          {rest.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {rest.map((entry, i) => (
                <LeaderboardRow key={entry.id} entry={entry} rank={i + 4} unit={challengeMeta.unit} />
              ))}
            </ul>
          )}
        </>
      )}

      <PrivacySettings settings={settings} onChange={updateSettings} />
    </section>
  )
}

function PodiumSlot({ entry, rank, unit }: { entry: LeaderboardEntry; rank: number; unit: string }) {
  const color = PODIUM_COLORS[rank - 1]
  const height = rank === 1 ? 96 : rank === 2 ? 76 : 60
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: 84 }}>
      <span className="text-2xl" aria-hidden>
        {entry.avatar}
      </span>
      <span className={cn('truncate text-caption', entry.isYou ? 'font-semibold text-accent-health' : 'text-text-secondary')} style={{ maxWidth: 84 }}>
        {entry.name}
      </span>
      {/* Deliberately its own element, never truncated with the name above — see
          togetherDemo.ts's header comment for why the disclosure can't live inside a
          width-clamped string. */}
      {entry.isDemo && (
        <span className="rounded-full bg-accent-energy/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-accent-energy">
          demo
        </span>
      )}
      <span className="text-data text-text-primary">
        {entry.value} {unit}
      </span>
      <div
        className="flex w-full items-center justify-center rounded-t-sm text-title font-semibold"
        style={{ height, backgroundColor: `${color}33`, boxShadow: `inset 0 0 0 1px ${color}80`, color }}
      >
        {rank}
      </div>
    </div>
  )
}

function LeaderboardRow({ entry, rank, unit }: { entry: LeaderboardEntry; rank: number; unit: string }) {
  return (
    <li
      className={cn(
        'glass-card flex items-center gap-3 px-3 py-2',
        entry.isYou && 'shadow-[0_0_12px_1px_var(--glow-health)]',
      )}
    >
      <span className="w-5 shrink-0 text-center text-caption text-text-tertiary">{rank}</span>
      <span className="text-lg" aria-hidden>
        {entry.avatar}
      </span>
      <span className={cn('min-w-0 flex-1 truncate text-body', entry.isYou ? 'font-semibold text-accent-health' : 'text-text-secondary')}>
        {entry.name}
      </span>
      {entry.isDemo && (
        <span className="shrink-0 rounded-full bg-accent-energy/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-accent-energy">
          demo
        </span>
      )}
      <span className="shrink-0 text-data text-text-primary">
        {entry.value} {unit}
      </span>
    </li>
  )
}

const SHARE_LEVEL_OPTIONS: { id: ShareLevel; label: string }[] = [
  { id: 'everyone', label: 'Everyone' },
  { id: 'friends', label: 'Friends only' },
  { id: 'none', label: 'No one' },
]

/**
 * Real, working, client-side-only privacy setting (per the task's explicit requirement to
 * include this even before the real multi-user backend exists). Persists via localStorage
 * (togetherDemo.ts's loadTogetherSettings/saveTogetherSettings) and genuinely controls whether
 * "you" appear in this device's own preview leaderboard above — not a decorative control.
 */
function PrivacySettings({
  settings,
  onChange,
}: {
  settings: { shareLevel: ShareLevel; displayName: string }
  onChange: (patch: Partial<{ shareLevel: ShareLevel; displayName: string }>) => void
}) {
  return (
    <div className="glass-card mt-4 flex flex-col gap-3 p-3">
      <div>
        <p className="mb-1 text-caption uppercase tracking-wide text-text-tertiary">Sharing</p>
        <div className="flex gap-2">
          {SHARE_LEVEL_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => onChange({ shareLevel: opt.id })}
              className={cn(
                'glass flex-1 rounded-full px-2 py-1.5 text-caption font-semibold transition',
                settings.shareLevel === opt.id ? 'text-accent-health shadow-[0_0_12px_1px_var(--glow-health)]' : 'text-text-tertiary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {settings.shareLevel !== 'none' && (
          <p className="mt-1.5 text-caption text-text-tertiary">
            {settings.shareLevel === 'everyone'
              ? "Everyone and Friends only behave the same in this preview — there's no real friend list yet. This setting is wired for when that ships."
              : 'Friends only (default) — same note as Everyone: no real friend graph exists yet in this preview.'}
          </p>
        )}
      </div>
      <div>
        <p className="mb-1 text-caption uppercase tracking-wide text-text-tertiary">Display name</p>
        <input
          value={settings.displayName}
          onChange={(e) => onChange({ displayName: e.target.value })}
          placeholder="You"
          maxLength={24}
          className="w-full rounded-sm bg-bg-tertiary px-2 py-1.5 text-body text-text-primary outline-none ring-1 ring-white/5 focus:ring-accent-ai"
        />
      </div>
    </div>
  )
}
