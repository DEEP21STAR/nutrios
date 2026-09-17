import { useState } from 'react'
import { CameraCapture } from '@/components/CameraCapture'
import { identifyMenuItemsViaOllama } from '@/lib/ollamaVision'
import type { IdentifiedItem } from '@/lib/ollamaVision'
import { resizeImage } from '@/lib/imageResize'
import { resolveIdentifiedItems } from '@/lib/resolveFoodItems'
import { uid } from '@/lib/utils'
import type { FoodItem } from '@/lib/types'

/**
 * Restaurant/Takeaway Mode entry point (Phase 3, 2026-09-16) — the third Input Orb path
 * alongside Photo and Voice. Real two-step flow, not a forced two-photo requirement:
 *   1. Photograph the MENU -> vision OCR extracts distinct dish names (identifyMenuItemsViaOllama,
 *      ollamaVision.ts) -> user confirms/edits which dish(es) they actually ordered.
 *   2. Optionally photograph the PLATE too, to visually sanity-check portion size — skippable.
 * Dish names then go through the exact same resolveIdentifiedItems() -> Open Food Facts
 * name-based lookup every other capture path uses (no new estimation system, per the task).
 *
 * Reuses CameraCapture itself (unchanged) for both photo steps rather than reinventing camera/
 * upload handling — its onCapture(blob)/onCancel API is already generic, not food-specific.
 *
 * HONEST LIMITATION, not overclaimed: qwen2.5vl:3b is a 3.8B model reading potentially small,
 * stylized, or angled menu text — this is a genuinely harder OCR task than identifying a lit
 * plate of food, the case this pipeline was originally tuned for. A larger resize (900px vs the
 * 640px used for food photos) is used here specifically to give menu text more pixels to work
 * with, at the cost of slower inference — but real accuracy on a busy/stylized menu photo should
 * be expected to be noticeably worse than the food-ID path, and every dish name stays editable
 * before it ever reaches Open Food Facts, same safety net as everywhere else in this app.
 */

type Stage = 'menu-photo' | 'identifying-menu' | 'review-dishes' | 'plate-prompt' | 'plate-photo' | 'resolving' | 'error'

interface CandidateDish extends IdentifiedItem {
  id: string
  checked: boolean
}

export function MenuCapture({
  onResolved,
  onCancel,
}: {
  onResolved: (
    items: FoodItem[],
    meta: { restaurantName: string; photo: { blob: Blob; dataUrl: string } | null },
  ) => void
  onCancel: () => void
}) {
  const [stage, setStage] = useState<Stage>('menu-photo')
  const [menuPhoto, setMenuPhoto] = useState<{ blob: Blob; dataUrl: string } | null>(null)
  const [candidates, setCandidates] = useState<CandidateDish[]>([])
  const [restaurantName, setRestaurantName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [endpointNote, setEndpointNote] = useState<string | null>(null)

  async function handleMenuPhoto(blob: Blob) {
    const dataUrl = await blobToDataUrl(blob)
    setMenuPhoto({ blob, dataUrl })
    setStage('identifying-menu')
    setErrorMessage(null)
    try {
      // 900px, not the 640px used for food photos — menu text needs more resolution than a
      // plate of food does to have any real chance of OCR'ing correctly (see file-header note).
      const resized = await resizeImage(blob, 900)
      const { items, endpointUsed } = await identifyMenuItemsViaOllama(resized)
      setEndpointNote(`Read via ${endpointUsed}`)
      setCandidates(items.map((it) => ({ ...it, id: uid(), checked: false })))
      setStage('review-dishes')
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? `Couldn't read the menu (${err.message}). Add the dish name(s) manually below.`
          : "Couldn't read the menu. Add the dish name(s) manually below.",
      )
      setCandidates([])
      setStage('review-dishes')
    }
  }

  function toggleCandidate(id: string) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, checked: !c.checked } : c)))
  }

  function updateCandidateName(id: string, name: string) {
    setCandidates((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)))
  }

  function removeCandidate(id: string) {
    setCandidates((prev) => prev.filter((c) => c.id !== id))
  }

  function addManualDish() {
    setCandidates((prev) => [...prev, { id: uid(), name: '', estimatedGrams: 350, checked: true }])
  }

  const selectedCount = candidates.filter((c) => c.checked && c.name.trim()).length

  async function resolveAndFinish(plate: { blob: Blob; dataUrl: string } | null) {
    setStage('resolving')
    const selected: IdentifiedItem[] = candidates
      .filter((c) => c.checked && c.name.trim())
      .map((c) => ({ name: c.name.trim(), estimatedGrams: c.estimatedGrams }))
    const resolved = await resolveIdentifiedItems(selected)
    onResolved(resolved, {
      restaurantName: restaurantName.trim(),
      photo: plate ?? menuPhoto,
    })
  }

  function cancel() {
    onCancel()
  }

  if (stage === 'menu-photo') {
    return <CameraCapture onCapture={handleMenuPhoto} onCancel={cancel} />
  }

  if (stage === 'plate-photo') {
    return <CameraCapture onCapture={(blob) => resolvePlatePhoto(blob)} onCancel={() => setStage('plate-prompt')} />
  }

  async function resolvePlatePhoto(blob: Blob) {
    const dataUrl = await blobToDataUrl(blob)
    await resolveAndFinish({ blob, dataUrl })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg-primary text-text-primary">
      <div className="flex items-center justify-between p-4">
        <button onClick={cancel} className="glass rounded-full px-4 py-2 text-caption text-text-primary">
          Cancel
        </button>
        <span className="glass rounded-full px-3 py-1 text-caption text-accent-energy shadow-[0_0_16px_2px_var(--glow-energy)]">
          Eating Out mode
        </span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-10">
        {stage === 'identifying-menu' && (
          <>
            {menuPhoto && (
              <div className="glass-card p-2">
                <img src={menuPhoto.dataUrl} alt="" className="h-40 w-40 rounded-md object-cover opacity-80" />
              </div>
            )}
            <p className="text-body text-accent-energy motion-safe:animate-pulse">Reading the menu…</p>
          </>
        )}

        {stage === 'review-dishes' && (
          <div className="flex w-full max-w-xs flex-col gap-3">
            {endpointNote && <p className="text-center text-caption text-text-tertiary">{endpointNote}</p>}
            {errorMessage && (
              <div className="glass-card p-3 text-center text-caption text-accent-danger">{errorMessage}</div>
            )}
            <p className="text-caption uppercase tracking-wide text-text-tertiary">Which dish(es) did you order?</p>
            {candidates.length === 0 && !errorMessage && (
              <p className="text-center text-caption text-text-tertiary">No dishes read from the photo.</p>
            )}
            <div className="flex flex-col gap-2">
              {candidates.map((c) => (
                <div
                  key={c.id}
                  className={cnGlass(c.checked)}
                >
                  <button
                    onClick={() => toggleCandidate(c.id)}
                    aria-label={c.checked ? 'Deselect dish' : 'Select dish'}
                    className={
                      'grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-xs transition ' +
                      (c.checked ? 'border-accent-health bg-accent-health text-bg-primary' : 'border-white/20 text-transparent')
                    }
                  >
                    ✓
                  </button>
                  <input
                    value={c.name}
                    onChange={(e) => updateCandidateName(c.id, e.target.value)}
                    placeholder="Dish name"
                    className="min-w-0 flex-1 rounded-sm bg-bg-tertiary px-2 py-1.5 text-body text-text-primary outline-none ring-1 ring-white/5 focus:ring-accent-ai"
                  />
                  <button
                    onClick={() => removeCandidate(c.id)}
                    aria-label="Remove dish"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-text-tertiary transition hover:bg-accent-danger/15 hover:text-accent-danger"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addManualDish}
              className="glass rounded-md border-dashed py-2 text-caption text-text-secondary transition active:scale-[0.98]"
            >
              + Add dish manually
            </button>

            <input
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="Restaurant / takeaway name (optional)"
              className="mt-2 w-full rounded-sm bg-bg-tertiary px-3 py-2 text-body text-text-primary outline-none ring-1 ring-white/5 focus:ring-accent-ai"
            />

            <button
              onClick={() => setStage('plate-prompt')}
              disabled={selectedCount === 0}
              className="mt-1 w-full rounded-full bg-accent-energy py-3 text-subtitle font-semibold text-bg-primary shadow-[0_0_24px_4px_var(--glow-energy)] transition active:scale-[0.98] disabled:opacity-40 disabled:shadow-none"
            >
              Continue ({selectedCount} selected)
            </button>
          </div>
        )}

        {stage === 'plate-prompt' && (
          <div className="flex w-full max-w-xs flex-col gap-3 text-center">
            <div className="glass-card p-4">
              <p className="text-body text-text-secondary">
                Add a photo of your actual plate too? It helps correct the portion size the menu
                photo can't show.
              </p>
            </div>
            <button
              onClick={() => setStage('plate-photo')}
              className="rounded-full bg-accent-health py-3 text-subtitle font-semibold text-bg-primary shadow-[0_0_24px_4px_var(--glow-health)] transition active:scale-95"
            >
              📸 Add plate photo
            </button>
            <button
              onClick={() => resolveAndFinish(null)}
              className="glass rounded-full py-2.5 text-caption text-text-secondary transition active:scale-95"
            >
              Skip — menu photo is enough
            </button>
          </div>
        )}

        {stage === 'resolving' && (
          <div className="flex flex-col items-center gap-3">
            <div className="glass-card p-6">
              <span className="text-3xl" aria-hidden>
                🍽️
              </span>
            </div>
            <p className="text-body text-accent-energy motion-safe:animate-pulse">Looking up nutrition…</p>
          </div>
        )}
      </div>
    </div>
  )
}

function cnGlass(checked: boolean): string {
  return (
    'glass-card flex items-center gap-2 p-2.5 transition ' +
    (checked ? 'ring-1 ring-accent-health/40' : '')
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
