import { useEffect, useState } from 'react'
import { CameraCapture, InputOrbButton } from '@/components/CameraCapture'
import { VoiceCapture } from '@/components/VoiceCapture'
import { MenuCapture } from '@/components/MenuCapture'
import { ConfirmLog } from '@/components/ConfirmLog'
import { TodayRing } from '@/components/TodayRing'
import { HealthyScoreGauge } from '@/components/HealthyScoreGauge'
import { MealTimeline } from '@/components/MealTimeline'
import { TipsTicker } from '@/components/TipsTicker'
import { Achievements } from '@/components/Achievements'
import { TogetherMode } from '@/components/TogetherMode'
import { TrendsHistory } from '@/components/TrendsHistory'
import { ProgressPhotos } from '@/components/ProgressPhotos'
import { TabBar, type TabKey } from '@/components/TabBar'
import { WhetuFooter } from '@/components/WhetuFooter'
import { SplashScreen } from '@/components/SplashScreen'
import { OnboardingWizard } from '@/components/OnboardingWizard'
import { SettingsPanel } from '@/components/SettingsPanel'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { getStoredTheme, applyTheme, type Theme } from '@/lib/theme'
import { identifyFoodViaOllama } from '@/lib/ollamaVision'
import { identifyFoodViaGemini } from '@/lib/geminiVision'
import { identifyFoodOnDevice, isWebGPUAvailable, type OnDeviceProgress } from '@/lib/onDeviceVision'
import { resizeImage } from '@/lib/imageResize'
import { resolveIdentifiedItems } from '@/lib/resolveFoodItems'
import { fireConfetti } from '@/lib/confetti'
import { playScanSuccessPing } from '@/lib/chime'
import { hapticSuccess, hapticCelebrate } from '@/lib/haptics'
import { ensureAuthenticated } from '@/lib/auth'
import { insertMeal, listTodayMeals, subscribeToMeals } from '@/lib/mealsRepo'
import { fetchGoals, saveGoals } from '@/lib/goalsRepo'
import { fetchAvatarUrl, fetchDisplayName, saveDisplayName } from '@/lib/avatarRepo'
import { sumMacros, DEFAULT_GOALS, type FoodItem, type Goals, type Meal } from '@/lib/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

type Stage = 'idle' | 'mode-select' | 'camera' | 'voice' | 'menu' | 'identifying' | 'confirm' | 'logging'

/**
 * Core loop, now backed by the real, live Supabase project
 * (ddbybgmysfvsxhadudne) — camera capture -> Ollama vision ID -> Open Food
 * Facts macro lookup -> editable confirm -> real Supabase Storage upload +
 * table insert -> ring fills + timeline updates (via a real Postgres
 * realtime subscription, not local-only state). Trends/History/Profile
 * screens and the cinematic/intelligence layer are still deliberately not
 * built — this round only replaced the mock data layer with real calls.
 */
export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('today')
  // On-device fallback progress (model download %, "running on-device", etc.) — shown on the
  // identifying overlay only while that path is actually in use, so the common Ollama-reachable
  // case never sees an unnecessary extra line.
  const [identifyingDetail, setIdentifyingDetail] = useState<string | null>(null)
  const [stage, setStage] = useState<Stage>('idle')
  // One place to react to "identification finished, food recognized" rather than duplicating a
  // sound/haptic call at every one of handleCapture's several setStage('confirm') exit points
  // (Ollama success, Gemini success, on-device success, on-device skipped) — this fires exactly
  // once per transition into 'confirm', regardless of which path got there.
  useEffect(() => {
    if (stage === 'confirm') {
      playScanSuccessPing()
      hapticSuccess()
    }
  }, [stage])
  const [capturedPhoto, setCapturedPhoto] = useState<{ blob: Blob; dataUrl: string } | null>(null)
  const [draftItems, setDraftItems] = useState<FoodItem[]>([])
  // Menu-mode entries carry these into ConfirmLog as pre-filled defaults (still fully editable
  // there — see ConfirmLog's own Eating Out toggle, which is available on every path, not just
  // menu-mode). Reset alongside draftItems/capturedPhoto in every path that leaves 'confirm'.
  const [draftIsEatingOut, setDraftIsEatingOut] = useState(false)
  const [draftRestaurantName, setDraftRestaurantName] = useState('')
  const [meals, setMeals] = useState<Meal[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [showSplash, setShowSplash] = useState(true)
  // null = still loading (or genuinely not onboarded yet); DEFAULT_GOALS is only ever used as a
  // placeholder while this resolves, never persisted or shown as if it were the real target.
  const [goals, setGoals] = useState<Goals | null>(null)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const [theme, setTheme] = useState<Theme>('dark')
  const [showSettings, setShowSettings] = useState(false)
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | undefined>(undefined)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      setSwRegistration(registration)
    },
  })

  // Theme is a user preference, not app data — apply the stored choice once on mount, same
  // pattern as any other localStorage-backed setting (independent of the Supabase auth bootstrap
  // below, since it has to work identically for a brand-new user who hasn't onboarded yet).
  useEffect(() => {
    const stored = getStoredTheme()
    applyTheme(stored)
    setTheme(stored)
  }, [])

  // PWA shortcut deep link ("Log a meal" on the home-screen icon's long-press menu, see
  // vite.config.ts's manifest.shortcuts) — only fires once goals have actually resolved (an
  // onboarded user), not mid-splash/onboarding, and strips the param so a later reload doesn't
  // keep reopening the camera.
  useEffect(() => {
    if (!goals) return
    const params = new URLSearchParams(window.location.search)
    if (params.get('action') === 'log-meal') {
      setStage('camera')
      params.delete('action')
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`
      window.history.replaceState({}, '', next)
    }
  }, [goals])

  async function handleCheckForUpdates(): Promise<boolean> {
    if (!swRegistration) return false
    const before = swRegistration.waiting
    await swRegistration.update()
    // A genuinely new SW starts installing asynchronously after update() resolves; give it a
    // moment rather than reading swRegistration.waiting synchronously, which would always be
    // whatever was already there (or nothing) before the update check had a chance to run.
    await new Promise((r) => setTimeout(r, 1000))
    return swRegistration.waiting !== before && swRegistration.waiting != null
  }

  // Bootstrap: real Supabase anonymous auth + real meals load + real
  // realtime subscription for cross-device sync. No mock data anywhere in
  // this path.
  useEffect(() => {
    let channel: RealtimeChannel | null = null
    let cancelled = false

    async function bootstrap() {
      try {
        const user = await ensureAuthenticated()
        if (cancelled) return
        setUserId(user.id)

        const today = await listTodayMeals(user.id)
        if (cancelled) return
        setMeals(today)

        channel = subscribeToMeals(user.id, (meal) => {
          setMeals((prev) => (prev.some((m) => m.id === meal.id) ? prev : [...prev, meal]))
        })

        // The `goals` table has existed since the very first migration, but nothing ever read
        // or wrote it until the onboarding wizard — every screen used DEFAULT_GOALS regardless
        // of who was using the app. A missing row means this user genuinely hasn't onboarded yet.
        const savedGoals = await fetchGoals(user.id)
        if (cancelled) return
        if (savedGoals) {
          setGoals(savedGoals)
        } else {
          setNeedsOnboarding(true)
        }

        const savedAvatar = await fetchAvatarUrl(user.id)
        if (cancelled) return
        setAvatarUrl(savedAvatar)

        const savedName = await fetchDisplayName(user.id)
        if (cancelled) return
        setDisplayName(savedName)
      } catch (err) {
        if (!cancelled) setAuthError(err instanceof Error ? err.message : 'Supabase sign-in failed.')
      }
    }
    bootstrap()

    return () => {
      cancelled = true
      channel?.unsubscribe()
    }
  }, [])

  const totals = sumMacros(meals.flatMap((m) => m.items))

  async function handleCapture(blob: Blob) {
    const dataUrl = await blobToDataUrl(blob)
    setCapturedPhoto({ blob, dataUrl })
    setDraftIsEatingOut(false)
    setDraftRestaurantName('')
    setStage('identifying')
    setStatusMessage(null)
    setIdentifyingDetail(null)

    // Resize before sending to the vision model — confirmed live during
    // core-loop testing that this cuts inference time ~5.7x on this
    // hardware, and an unresized photo has previously blown the model's
    // context window entirely. Shared by both the Ollama and on-device paths.
    const resizedForVision = await resizeImage(blob, 640)

    // Three real vision paths, tried in order — each with a genuinely different failure mode,
    // so none of them can substitute for the others:
    //   1. Ollama (home/Tailscale) — best quality, needs the laptop on and reachable.
    //   2. Gemini via the identify-food Edge Function — the shared-family path (2026-09-17):
    //      one Gemini key held server-side, invisible to every device, needs only internet
    //      (wifi or mobile data), no per-device capability required.
    //   3. On-device WebGPU — free forever, fully offline once cached, but real hardware/browser
    //      support varies (confirmed absent on Deep's own phone) — last resort, not first.
    const failures: string[] = []

    try {
      const { items, endpointUsed } = await identifyFoodViaOllama(resizedForVision)
      setStatusMessage(`Identified via ${endpointUsed}`)
      setDraftItems(await resolveIdentifiedItems(items))
      setStage('confirm')
      return
    } catch (ollamaErr) {
      failures.push(`Ollama: ${ollamaErr instanceof Error ? ollamaErr.message : 'failed'}`)
    }

    try {
      setIdentifyingDetail('Trying shared vision service…')
      const items = await identifyFoodViaGemini(resizedForVision)
      setStatusMessage('Identified via shared vision service')
      setDraftItems(await resolveIdentifiedItems(items))
      setStage('confirm')
      return
    } catch (geminiErr) {
      failures.push(`Shared vision service: ${geminiErr instanceof Error ? geminiErr.message : 'failed'}`)
    }

    if (!isWebGPUAvailable()) {
      // Distinct from a plain failure — explicitly says the on-device attempt was never made,
      // not that it was tried and failed, so this doesn't get misread as a bug in that path.
      setStatusMessage(`${failures.join(' | ')} | On-device: skipped — this browser has no WebGPU.`)
      setDraftItems([])
      setStage('confirm')
      return
    }

    try {
      setIdentifyingDetail('Starting on-device model (first time: one download, then instant)…')
      const items = await identifyFoodOnDevice(resizedForVision, (p: OnDeviceProgress) => {
        if (p.status === 'progress' && typeof p.progress === 'number') {
          setIdentifyingDetail(`Downloading on-device model… ${Math.round(p.progress)}%`)
        } else if (p.status === 'ready' || p.status === 'done') {
          setIdentifyingDetail('Running on-device…')
        }
      })
      setStatusMessage('Identified on-device (offline)')
      setDraftItems(await resolveIdentifiedItems(items))
      setStage('confirm')
    } catch (onDeviceErr) {
      failures.push(`On-device: ${onDeviceErr instanceof Error ? onDeviceErr.message : 'failed'}`)
      setStatusMessage(failures.join(' | '))
      setDraftItems([])
      setStage('confirm') // still let the user log manually — manual-entry fallback
    } finally {
      setIdentifyingDetail(null)
    }
  }

  /**
   * Voice path's final step, run once VoiceCapture has a resolved item list
   * (either straight from the AI's first pass, or after it asked one or more
   * clarifying follow-up questions). No photo exists for a voice-logged meal
   * — capturedPhoto stays null, which ConfirmLog and the logging overlay
   * both render around rather than require.
   */
  function handleVoiceResolved(items: FoodItem[]) {
    setCapturedPhoto(null)
    setDraftItems(items)
    setDraftIsEatingOut(false)
    setDraftRestaurantName('')
    setStage('confirm')
  }

  /**
   * Menu path's final step (Phase 3, Restaurant/Takeaway Mode), run once MenuCapture has
   * resolved the user's confirmed dish selection through Open Food Facts. `meta.photo` is
   * whichever photo MenuCapture decided to keep — the plate photo if the user added one,
   * otherwise the menu photo itself (see MenuCapture.tsx's own header comment for why this app
   * keeps exactly one photo per meal rather than two). Eating Out defaults to ON here since the
   * whole point of this entry point is a restaurant/takeaway meal — still just a default, fully
   * togglable in ConfirmLog like every other path.
   */
  function handleMenuResolved(
    items: FoodItem[],
    meta: { restaurantName: string; photo: { blob: Blob; dataUrl: string } | null },
  ) {
    setCapturedPhoto(meta.photo)
    setDraftItems(items)
    setDraftIsEatingOut(true)
    setDraftRestaurantName(meta.restaurantName)
    setStage('confirm')
  }

  async function handleConfirm(draft: Meal) {
    if (!userId) {
      setStatusMessage('Not signed in to Supabase yet — cannot log this meal.')
      return
    }
    setStage('logging')
    try {
      const savedMeal = await insertMeal(userId, capturedPhoto?.blob ?? null, draft.items, {
        isEatingOut: draft.isEatingOut,
        restaurantName: draft.restaurantName,
      })
      setMeals((prev) => (prev.some((m) => m.id === savedMeal.id) ? prev : [...prev, savedMeal]))
      setStatusMessage(null)
      fireConfetti()
      hapticCelebrate()
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to save meal to Supabase.')
    } finally {
      setStage('idle')
      setCapturedPhoto(null)
      setDraftItems([])
      setDraftIsEatingOut(false)
      setDraftRestaurantName('')
    }
  }

  async function handleOnboardingComplete(newGoals: Goals, name: string) {
    setGoals(newGoals)
    setNeedsOnboarding(false)
    if (name) setDisplayName(name)
    if (userId) {
      try {
        await saveGoals(userId, newGoals)
      } catch (err) {
        // Real goals are already in state and the app is usable either way — a failed write just
        // means this device's answers won't persist across reloads/devices yet, not a blocker.
        setStatusMessage(err instanceof Error ? err.message : 'Could not save your goals to Supabase.')
      }
      if (name) {
        try {
          await saveDisplayName(userId, name)
        } catch (err) {
          setStatusMessage(err instanceof Error ? err.message : 'Could not save your name to Supabase.')
        }
      }
    }
  }

  // The splash renders as an overlay ALONGSIDE whichever real screen is underneath (onboarding
  // or the main app), not as an early return replacing it — the iris-wipe reveal animation
  // needs the real content already mounted and painted behind it to actually reveal, rather
  // than just cutting to a blank moment before the real screen mounts. Deliberately NOT
  // extracted into a nested component function (a real, easy-to-miss anti-pattern) — that would
  // redefine a new component type on every App render, remounting the whole tree (and every
  // child's own internal state, e.g. mid-capture UI) any time meals/goals/etc. change.
  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      {needsOnboarding ? (
        <OnboardingWizard onComplete={handleOnboardingComplete} />
      ) : (
        <div className="relative z-10 mx-auto flex min-h-screen max-w-md flex-col overflow-x-hidden pb-40 text-text-primary">
      {/* Ambient background glow — subtle, static, sits behind everything. Starfield canvas
          (index.html) now shows through here — Phase 1's "no particles" scope was revised. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-80 opacity-30"
        style={{ background: 'radial-gradient(60% 60% at 50% 0%, var(--glow-ai), transparent 70%)' }}
      />

      <header className="relative p-4 text-center">
        <button
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
          className="absolute right-4 top-4 text-text-tertiary"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.4.6a7.6 7.6 0 0 0-1.7-1l-.3-2.5H9l-.3 2.5a7.6 7.6 0 0 0-1.7 1l-2.4-.6-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.4-.6a7.6 7.6 0 0 0 1.7 1l.3 2.5h6l.3-2.5a7.6 7.6 0 0 0 1.7-1l2.4.6 2-3.4-2-1.5Z" />
          </svg>
        </button>
        <h1 className="text-title">
          {activeTab === 'today' ? 'Today' : activeTab === 'progress' ? 'Progress' : 'Together'}
        </h1>
        {authError && <p className="mt-1 text-caption text-accent-danger">{authError}</p>}
        {statusMessage && <p className="mt-1 text-caption text-text-tertiary">{statusMessage}</p>}
      </header>

      {showSettings && (
        <SettingsPanel
          onClose={() => setShowSettings(false)}
          theme={theme}
          onThemeChange={setTheme}
          needRefresh={needRefresh}
          onUpdate={() => updateServiceWorker(true)}
          onCheckForUpdates={handleCheckForUpdates}
          userId={userId}
          avatarUrl={avatarUrl}
          onAvatarChange={setAvatarUrl}
          displayName={displayName}
          onDisplayNameChange={setDisplayName}
        />
      )}

      {/* Tabbed layout (2026-09-17) — was one continuous scroll through every section
          regardless of what the user actually came here to do. Each tab below is exactly the
          same components/props as before, just gated by activeTab instead of always-rendered,
          so none of them had to change their own data-fetching logic. */}
      {activeTab === 'today' && (
        <>
          <TodayRing totals={totals} goals={goals ?? DEFAULT_GOALS} />
          {/* Phase 5, Healthy Score — added alongside TodayRing, not replacing any part of it
              (see HealthyScoreGauge.tsx's own header comment for why). */}
          <HealthyScoreGauge totals={totals} goals={goals ?? DEFAULT_GOALS} todaysMeals={meals} />
          <MealTimeline meals={meals} />
          <TipsTicker meals={meals} goals={goals ?? DEFAULT_GOALS} />
        </>
      )}

      {activeTab === 'progress' && (
        <>
          {/* Phase 4 — achievements computed from real meal history, see the component's own
              header comment for what's real vs. demo. */}
          <Achievements meals={meals} goals={goals ?? DEFAULT_GOALS} />
          {/* Phase 5, Trends & History — real weekly calorie bar chart + weight trend (or its
              honest empty state). */}
          <TrendsHistory userId={userId} goals={goals ?? DEFAULT_GOALS} />
          {/* Progress photos — private timeline + before/after compare + share, its own
              top-level section matching Achievements/TrendsHistory's pattern. */}
          {userId && <ProgressPhotos userId={userId} />}
        </>
      )}

      {activeTab === 'together' && (
        <TogetherMode meals={meals} goals={goals ?? DEFAULT_GOALS} avatarUrl={avatarUrl} userId={userId} />
      )}

      {/* mt-auto pins this to the bottom of the flex column regardless of how tall each tab's
          own content is — without it, a short tab (e.g. Today with no meals logged) leaves the
          footer stranded mid-page with a big dead gap before the fixed camera/tab-bar clearance
          below (real bug, caught from a live screenshot: looked like the footer "wasn't at the
          bottom" even though it was technically the last DOM child). */}
      <WhetuFooter className="mt-auto" name={displayName} />

      <InputOrbButton onClick={() => setStage('mode-select')} />
      <TabBar active={activeTab} onChange={setActiveTab} />

      {stage === 'mode-select' && (
        <InputModeSheet
          onPhoto={() => setStage('camera')}
          onVoice={() => setStage('voice')}
          onMenu={() => setStage('menu')}
          onCancel={() => setStage('idle')}
        />
      )}

      {stage === 'camera' && <CameraCapture onCapture={handleCapture} onCancel={() => setStage('idle')} />}

      {stage === 'voice' && (
        <VoiceCapture onResolved={handleVoiceResolved} onCancel={() => setStage('idle')} />
      )}

      {stage === 'menu' && (
        <MenuCapture onResolved={handleMenuResolved} onCancel={() => setStage('idle')} />
      )}

      {stage === 'identifying' && capturedPhoto && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg-primary/95">
          <div className="glass-card relative overflow-hidden p-2">
            <img src={capturedPhoto.dataUrl} alt="" className="h-40 w-40 rounded-md object-cover opacity-80" />
            <div className="identify-scanline" aria-hidden />
          </div>
          <p className="text-body text-accent-ai motion-safe:animate-pulse">Identifying food…</p>
          {identifyingDetail && <p className="text-caption text-text-tertiary">{identifyingDetail}</p>}
        </div>
      )}

      {stage === 'confirm' && (
        <ConfirmLog
          photoDataUrl={capturedPhoto?.dataUrl ?? null}
          initialItems={draftItems}
          pastMeals={meals}
          initialIsEatingOut={draftIsEatingOut}
          initialRestaurantName={draftRestaurantName}
          todaysTotals={totals}
          goals={goals ?? DEFAULT_GOALS}
          identificationNote={statusMessage}
          onConfirm={handleConfirm}
          onCancel={() => {
            setStage('idle')
            setCapturedPhoto(null)
            setDraftItems([])
            setDraftIsEatingOut(false)
            setDraftRestaurantName('')
          }}
        />
      )}

      {stage === 'logging' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-bg-primary/95">
          <div className="glass-card p-2">
            {capturedPhoto ? (
              <img src={capturedPhoto.dataUrl} alt="" className="h-40 w-40 rounded-md object-cover opacity-80" />
            ) : (
              <div className="grid h-40 w-40 place-items-center rounded-md text-4xl" aria-hidden>
                🎙️
              </div>
            )}
          </div>
          <p className="text-body text-accent-health motion-safe:animate-pulse">Saving to Supabase…</p>
        </div>
      )}
        </div>
        )}
    </>
  )
}

/**
 * Tapping the orb now offers three genuinely distinct entry points instead of
 * jumping straight to the camera — Photo (existing CameraCapture, itself
 * still offering live camera + gallery/files), Voice (VoiceCapture), and
 * Eating Out (MenuCapture, Phase 3 — menu-photo OCR + optional plate photo).
 * Styled with the same glass button language as CameraCapture's
 * UploadOptions rather than inventing a new sheet pattern.
 */
function InputModeSheet({
  onPhoto,
  onVoice,
  onMenu,
  onCancel,
}: {
  onPhoto: () => void
  onVoice: () => void
  onMenu: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-end bg-black/60 p-6 pb-10">
      <div className="glass-card flex w-full max-w-xs flex-col gap-2 p-4">
        <p className="mb-1 text-center text-caption uppercase tracking-wide text-text-tertiary">Log a meal</p>
        <button
          onClick={onPhoto}
          className="glass flex items-center justify-center gap-2 rounded-full px-6 py-3 text-subtitle font-semibold text-accent-health shadow-[0_0_24px_4px_var(--glow-health)] transition active:scale-95"
        >
          <span aria-hidden>📷</span> Photo
        </button>
        <button
          onClick={onVoice}
          className="glass flex items-center justify-center gap-2 rounded-full px-6 py-3 text-subtitle font-semibold text-accent-ai shadow-[0_0_24px_4px_var(--glow-ai)] transition active:scale-95"
        >
          <span aria-hidden>🎙️</span> Voice
        </button>
        <button
          onClick={onMenu}
          className="glass flex items-center justify-center gap-2 rounded-full px-6 py-3 text-subtitle font-semibold text-accent-energy shadow-[0_0_24px_4px_var(--glow-energy)] transition active:scale-95"
        >
          <span aria-hidden>🍽️</span> Eating Out
        </button>
        <button onClick={onCancel} className="mt-1 text-caption text-text-tertiary underline">
          Cancel
        </button>
      </div>
    </div>
  )
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
