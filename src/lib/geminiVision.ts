/**
 * Shared-family vision fallback (2026-09-17) — calls the `identify-food` Supabase Edge
 * Function, which holds the one real Gemini API key server-side. No family member's device
 * ever sees a key or needs one; the app just calls this the same way every other Supabase
 * request already works. Needs internet (any kind — wifi or mobile data), but nothing
 * device-specific like WebGPU, so this is the reliable fallback when Ollama's unreachable,
 * ahead of the on-device path in the chain (see App.tsx's handleCapture).
 */
import { supabase } from '@/lib/supabase'
import type { IdentifiedItem } from '@/lib/ollamaVision'

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read image as base64'))
    reader.readAsDataURL(blob)
  })
}

/** Raw shape actually returned by the Edge Function — `estimated_grams`, snake_case, straight
 * from Gemini's own JSON. NOT the same shape as `IdentifiedItem` (`estimatedGrams`, camelCase) —
 * real bug, found live: casting the raw response directly as IdentifiedItem[] left
 * `estimatedGrams` undefined on every item, which cascaded into NaN kcal/macros on the confirm
 * screen. ollamaVision.ts already does this exact rename at its own boundary; this was just
 * missing here. */
type RawGeminiItem = { name: string; estimated_grams: number }

export async function identifyFoodViaGemini(photo: Blob): Promise<IdentifiedItem[]> {
  const imageBase64 = await blobToBase64(photo)
  const mimeType = photo.type || 'image/jpeg'

  const { data, error } = await supabase.functions.invoke<{ items?: RawGeminiItem[]; error?: string }>(
    'identify-food',
    { body: { imageBase64, mimeType } },
  )

  if (error) {
    throw new Error(`Shared vision service unreachable: ${error.message}`)
  }
  if (data?.error) {
    throw new Error(`Shared vision service error: ${data.error}`)
  }
  const rawItems = data?.items ?? []
  if (rawItems.length === 0) {
    throw new Error('Shared vision service returned zero items')
  }
  return rawItems.map((it) => ({ name: it.name, estimatedGrams: Number(it.estimated_grams) || 100 }))
}
