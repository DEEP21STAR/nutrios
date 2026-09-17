import { lookupFoodMacros, scaleToPortion } from '@/lib/openFoodFacts'
import { uid } from '@/lib/utils'
import type { FoodItem } from '@/lib/types'
import type { IdentifiedItem } from '@/lib/ollamaVision'

/**
 * Open Food Facts resolution step shared by both capture paths: the photo
 * path (App.tsx's handleCapture, items come from Ollama vision) and the
 * voice/text path (VoiceCapture.tsx, items come from parseFoodTextViaOllama).
 * Extracted verbatim from the logic that used to live only inline in
 * handleCapture — identical behavior, just callable from two places instead
 * of duplicated.
 */
export async function resolveIdentifiedItems(items: IdentifiedItem[]): Promise<FoodItem[]> {
  return Promise.all(
    items.map(async (item): Promise<FoodItem> => {
      try {
        const off = await lookupFoodMacros(item.name)
        if (!off) {
          return {
            id: uid(),
            name: item.name,
            estimatedGrams: item.estimatedGrams,
            calories: 0,
            proteinG: 0,
            fatG: 0,
            carbsG: 0,
          }
        }
        const macros = scaleToPortion(off, item.estimatedGrams)
        return {
          id: uid(),
          name: off.productName || item.name,
          estimatedGrams: item.estimatedGrams,
          offCode: off.code,
          ...macros,
        }
      } catch {
        return {
          id: uid(),
          name: item.name,
          estimatedGrams: item.estimatedGrams,
          calories: 0,
          proteinG: 0,
          fatG: 0,
          carbsG: 0,
        }
      }
    }),
  )
}
