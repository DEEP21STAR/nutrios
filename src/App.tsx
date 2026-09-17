import { useEffect, useState } from 'react'
import { CameraCapture, InputOrbButton } from '@/components/CameraCapture'
import { VoiceCapture } from '@/components/VoiceCapture'
import { MenuCapture } from '@/components/MenuCapture'
import { ConfirmLog } from '@/components/ConfirmLog'
import { TodayRing } from '@/components/TodayRing'
import { MealTimeline } from '@/components/MealTimeline'
import { TipsTicker } from '@/components/TipsTicker'
import { Achievements } from '@/components/Achievements'
import { TogetherMode } from '@/components/TogetherMode'
import { identifyFoodViaOllama } from '@/lib/ollamaVision'
import { resizeImage } from '@/lib/imageResize'
import { resolveIdentifiedItems } from '@/lib/resolveFoodItems'
import { fireConfetti } from '@/lib/confetti'
import { ensureAuthenticated } from '@/lib/auth'
import { insertMeal, listTodayMeals, subscribeToMeals } from '@/lib/mealsRepo'
import { sumMacros, DEFAULT_GOALS, type FoodItem, type Meal } from '@/lib/types'
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
  const [stage, setStage] = useState<Stage>('idle')
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

    try {
      // Resize before sending to the vision model — confirmed live during
      // core-loop testing that this cuts inference time ~5.7x on this
      // hardware, and an unresized photo has previously blown the model's
      // context window entirely.
      const resizedForVision = await resizeImage(blob, 640)
      const { items, endpointUsed } = await identifyFoodViaOllama(resizedForVision)
      setStatusMessage(`Identified via ${endpointUsed}`)

      const resolved = await resolveIdentifiedItems(items)
      setDraftItems(resolved)
      setStage('confirm')
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Vision identification failed.')
      setDraftItems([])
      setStage('confirm') // still let the user log manually — manual-entry fallback
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

  return (
    <div className="relative mx-auto min-h-screen max-w-md overflow-x-hidden bg-bg-primary pb-28 text-text-primary">
      {/* Ambient background glow — subtle, static (no parallax/particles per Phase 1 scope), sits behind everything. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-80 opacity-30"
        style={{ background: 'radial-gradient(60% 60% at 50% 0%, var(--glow-ai), transparent 70%)' }}
      />

      <header className="relative p-4 text-center">
        <h1 className="text-title">Today</h1>
        {authError && <p className="mt-1 text-caption text-accent-danger">{authError}</p>}
        {statusMessage && <p className="mt-1 text-caption text-text-tertiary">{statusMessage}</p>}
      </header>

      <TodayRing totals={totals} goals={DEFAULT_GOALS} />
      <MealTimeline meals={meals} />

      {/* Phase 4, Together Mode — tips ticker (real personalized tips when there's enough
          history, generic fallback tips otherwise), achievements computed from real meal
          history, and the honestly-labeled social preview. See each component's own header
          comment for what's real vs. demo. */}
      <TipsTicker meals={meals} goals={DEFAULT_GOALS} />
      <Achievements meals={meals} goals={DEFAULT_GOALS} />
      <TogetherMode meals={meals} goals={DEFAULT_GOALS} />

      <InputOrbButton onClick={() => setStage('mode-select')} />

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
          <div className="glass-card p-2">
            <img src={capturedPhoto.dataUrl} alt="" className="h-40 w-40 rounded-md object-cover opacity-80" />
          </div>
          <p className="text-body text-accent-ai motion-safe:animate-pulse">Identifying food…</p>
        </div>
      )}

      {stage === 'confirm' && (
        <ConfirmLog
          photoDataUrl={capturedPhoto?.dataUrl ?? null}
          initialItems={draftItems}
          pastMeals={meals}
          initialIsEatingOut={draftIsEatingOut}
          initialRestaurantName={draftRestaurantName}
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
