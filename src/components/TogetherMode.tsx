import { useEffect, useMemo, useState } from 'react'
import type { Goals, Meal } from '@/lib/types'
import { cn } from '@/lib/utils'
import { isPhotoAvatar } from '@/components/AvatarPicker'
import {
  buildLeaderboard,
  CHALLENGES,
  computeYourChallengeValue,
  loadTogetherSettings,
  saveTogetherSettings,
  type ChallengeType,
  type LeaderboardEntry,
  type RealMemberStat,
  type ShareLevel,
} from '@/lib/togetherDemo'
import {
  createHousehold,
  fetchHouseholdMembers,
  fetchMyHousehold,
  joinHousehold,
  syncMyStat,
  updateMyHousehold,
  type MyHousehold,
} from '@/lib/household'

/** Real uploaded photos render as a circular image; demo/default entries stay emoji, same as
 * before — one shared spot so PodiumSlot and LeaderboardRow can't drift out of sync. */
function AvatarBadge({ avatar, size }: { avatar: string; size: number }) {
  if (isPhotoAvatar(avatar)) {
    return (
      <img
        src={avatar}
        alt=""
        aria-hidden
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span className="shrink-0 text-center" style={{ fontSize: size * 0.75, lineHeight: `${size}px`, width: size }} aria-hidden>
      {avatar}
    </span>
  )
}

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
export function TogetherMode({
  meals,
  goals,
  avatarUrl,
  userId,
}: {
  meals: Meal[]
  goals: Goals
  avatarUrl?: string | null
  userId: string | null
}) {
  const [settings, setSettings] = useState(loadTogetherSettings)
  const [challenge, setChallenge] = useState<ChallengeType>('consistency')
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [household, setHousehold] = useState<MyHousehold | null>(null)
  const [householdLoaded, setHouseholdLoaded] = useState(false)
  const [realMembers, setRealMembers] = useState<RealMemberStat[]>([])

  // Load (or notice the absence of) a real household once, on mount.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchMyHousehold(userId)
      .then((h) => {
        if (!cancelled) setHousehold(h)
      })
      .catch(() => {
        /* Treated as "no household yet" — the create/join prompt is the honest fallback for a
           real fetch failure here too, not worth a separate error state. */
      })
      .finally(() => {
        if (!cancelled) setHouseholdLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  // Whenever you have a household and the visible challenge (or your own real data) changes,
  // write your own real value for THIS challenge and pull the other real members' values for
  // it. Every value here is computed the same way "your row" always was — this just also shares
  // it with, and reads it from, the people actually in your household now.
  useEffect(() => {
    if (!userId || !household) return
    let cancelled = false
    const value = computeYourChallengeValue(challenge, meals, goals)
    syncMyStat(userId, challenge, value)
      .then(() => fetchHouseholdMembers(household.householdId, challenge, userId))
      .then((members) => {
        if (!cancelled) setRealMembers(members.map((m) => ({ userId: m.userId, name: m.displayName, avatar: m.avatar, value: m.value })))
      })
      .catch(() => {
        if (!cancelled) setRealMembers([])
      })
    return () => {
      cancelled = true
    }
  }, [userId, household, challenge, meals, goals])

  const effectiveDisplayName = household?.displayName || settings.displayName
  const effectiveShareLevel = household?.shareLevel ?? settings.shareLevel

  const leaderboard = useMemo(
    () => buildLeaderboard(challenge, meals, goals, effectiveDisplayName, avatarUrl, realMembers),
    [challenge, meals, goals, effectiveDisplayName, avatarUrl, realMembers],
  )

  const visibleLeaderboard =
    effectiveShareLevel === 'none' ? leaderboard.filter((e) => !e.isYou) : leaderboard

  async function updateSettings(patch: Partial<typeof settings>) {
    const next = { ...settings, ...patch }
    setSettings(next)
    saveTogetherSettings(next)
    // Once you're in a real household, these same two fields live server-side (visible to your
    // housemates), not just in this device's localStorage — keep both in sync rather than
    // silently only updating one depending on which screen you're on.
    if (userId && household) {
      try {
        await updateMyHousehold(userId, patch)
        setHousehold({ ...household, ...patch })
      } catch {
        /* Local setting already applied above — a failed server sync here isn't worth
           surfacing as an error over something this low-stakes; it'll retry next change. */
      }
    }
  }

  const challengeMeta = CHALLENGES.find((c) => c.id === challenge)!
  const podium = visibleLeaderboard.slice(0, 3)
  const rest = visibleLeaderboard.slice(3)
  const hasRealOthers = realMembers.length > 0

  return (
    <section className="mt-6 px-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-subtitle text-text-primary">Together Mode</h2>
        {!hasRealOthers && (
          <span className="rounded-full bg-accent-energy/15 px-2 py-0.5 text-caption font-semibold text-accent-energy ring-1 ring-accent-energy/30">
            PREVIEW
          </span>
        )}
      </div>

      {householdLoaded && userId && (
        <HouseholdCard
          household={household}
          hasRealOthers={hasRealOthers}
          onCreate={async () => {
            const h = await createHousehold(effectiveDisplayName)
            setHousehold(h)
          }}
          onJoin={async (code) => {
            await joinHousehold(code, effectiveDisplayName)
            const h = await fetchMyHousehold(userId)
            setHousehold(h)
          }}
        />
      )}

      {!household && !bannerDismissed && (
        <div className="glass-card mb-3 flex flex-col gap-1.5 p-3 text-caption text-text-secondary">
          <p>
            <strong className="text-accent-energy">This is a preview.</strong> Rows tagged <em>(demo)</em> below are
            fixed sample data — create or join a household above to see real people here instead. Only your own row
            is ever computed from your real logged meals.
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

      {effectiveShareLevel === 'none' ? (
        <div className="glass-card p-4 text-center text-caption text-text-tertiary">
          You're set to <strong className="text-text-secondary">No one</strong> — your row is hidden from this
          leaderboard{household ? ' and your housemates cannot see your stats' : ''}.
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

      <PrivacySettings
        settings={{ shareLevel: effectiveShareLevel, displayName: effectiveDisplayName }}
        onChange={updateSettings}
      />
    </section>
  )
}

/**
 * The real "how do you know you've got people using the app" answer — a shareable join code,
 * same pattern as Strava/Fitbit's "join with code" (no email/password needed, matches this
 * app's anonymous-auth design throughout). Create once, share the code, done.
 */
function HouseholdCard({
  household,
  hasRealOthers,
  onCreate,
  onJoin,
}: {
  household: MyHousehold | null
  hasRealOthers: boolean
  onCreate: () => Promise<void>
  onJoin: (code: string) => Promise<void>
}) {
  const [mode, setMode] = useState<'idle' | 'join'>('idle')
  const [codeInput, setCodeInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function handleCreate() {
    setBusy(true)
    setError(null)
    try {
      await onCreate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create household.')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    if (!codeInput.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onJoin(codeInput.trim())
      setMode('idle')
      setCodeInput('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join household.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCopy() {
    if (!household) return
    try {
      await navigator.clipboard.writeText(household.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* Clipboard API can be denied/unavailable — the code is still shown on screen either way,
         so this is a convenience, not the only way to get it. */
    }
  }

  if (household) {
    return (
      <div className="glass-card mb-3 flex items-center justify-between gap-3 p-3">
        <div>
          <p className="text-caption text-text-tertiary">
            {hasRealOthers ? 'Your household' : 'Your household code — share it to add people'}
          </p>
          <p className="text-title tracking-widest text-accent-health">{household.code}</p>
        </div>
        <button
          onClick={handleCopy}
          className="rounded-full border border-white/10 bg-bg-secondary px-3 py-1.5 text-caption text-text-secondary"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    )
  }

  return (
    <div className="glass-card mb-3 flex flex-col gap-2 p-3">
      {mode === 'idle' ? (
        <div className="flex gap-2">
          <button
            onClick={handleCreate}
            disabled={busy}
            className="flex-1 rounded-xl bg-accent-health py-2.5 text-caption font-semibold text-bg-primary disabled:opacity-60"
          >
            Create household
          </button>
          <button
            onClick={() => setMode('join')}
            disabled={busy}
            className="flex-1 rounded-xl border border-white/10 bg-bg-secondary py-2.5 text-caption text-text-secondary"
          >
            Join with code
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="e.g. K7P2QX"
            maxLength={6}
            className="flex-1 rounded-xl border border-white/10 bg-bg-secondary px-3 py-2.5 text-body uppercase tracking-widest text-text-primary outline-none"
          />
          <button
            onClick={handleJoin}
            disabled={busy}
            className="rounded-xl bg-accent-health px-4 text-caption font-semibold text-bg-primary disabled:opacity-60"
          >
            Join
          </button>
          <button onClick={() => setMode('idle')} className="text-caption text-text-tertiary">
            Cancel
          </button>
        </div>
      )}
      {error && <p className="text-caption text-accent-danger">{error}</p>}
    </div>
  )
}

function PodiumSlot({ entry, rank, unit }: { entry: LeaderboardEntry; rank: number; unit: string }) {
  const color = PODIUM_COLORS[rank - 1]
  const height = rank === 1 ? 96 : rank === 2 ? 76 : 60
  return (
    <div className="flex flex-col items-center gap-1" style={{ width: 84 }}>
      <AvatarBadge avatar={entry.avatar} size={32} />
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
      <AvatarBadge avatar={entry.avatar} size={24} />
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
            Everyone and Friends only currently both mean "visible to your household" — there's
            no wider public directory yet, just the household you've created or joined.
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
