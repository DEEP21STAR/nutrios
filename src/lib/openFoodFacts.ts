/**
 * Open Food Facts lookup — same public API already proven in tonight's CLI
 * build. Free, no key required, CORS-open (world.openfoodfacts.org serves
 * `Access-Control-Allow-Origin: *`). Used to turn a food NAME identified by
 * the vision model into real macro numbers (calories/protein/fat/carbs) per
 * 100g, which we then scale by the vision model's estimated portion size.
 */

import { matchCommonFood } from '@/lib/commonFoods'
import { getCachedFoodLookup, cacheFoodLookup } from '@/lib/offlineFoodCache'

export interface OffMacros {
  code: string
  productName: string
  caloriesPer100g: number
  proteinPer100gG: number
  fatPer100gG: number
  carbsPer100gG: number
  /** Optional — not every OFF product or common-food entry has these (verified against a real
   * OFF product response before naming these fields: fiber_100g/sugars_100g are real, standard
   * keys, not guessed). */
  fiberPer100gG?: number
  sugarPer100gG?: number
}

interface OffSearchResponse {
  products?: Array<{
    code?: string
    product_name?: string
    product_name_en?: string
    nutriments?: Record<string, number>
  }>
}

/**
 * Searches Open Food Facts by free-text food name and returns the best-match
 * macro profile (per 100g), or null if nothing usable was found. Real network
 * call — no mock/fallback data invented here; a null result means the UI's
 * editable confirm step is genuinely empty for that item and the user fills
 * it in by hand (see the manual-text-search fallback requirement).
 *
 * Retries once after a short delay on a 5xx — found live during core-loop
 * testing: the public API returned a real (not hypothetical) transient 503
 * "Page temporarily unavailable" for one request, which had fully recovered
 * 3 seconds later on a plain retry. Without this, that single hiccup would
 * silently zero out an item's macros in the confirm screen.
 *
 * 2026-09-18: checks two things BEFORE ever touching the network, in order —
 *   1. commonFoods.ts's curated whole-foods dataset — fixes both the offline case AND this
 *      file's own documented weak spot (OFF being a branded-product database, not a whole-food
 *      one; "olives" matching olive oil, "banana" resolving to zero, both real, both here).
 *   2. offlineFoodCache.ts — anything looked up successfully before, cached, works offline.
 * A cache miss + no common-food match still falls through to the real network call exactly as
 * before, and a successful network result gets cached for next time.
 */
export async function lookupFoodMacros(query: string): Promise<OffMacros | null> {
  const common = matchCommonFood(query)
  if (common) {
    return {
      code: '',
      productName: common.name,
      caloriesPer100g: common.caloriesPer100g,
      proteinPer100gG: common.proteinPer100gG,
      fatPer100gG: common.fatPer100gG,
      carbsPer100gG: common.carbsPer100gG,
      fiberPer100gG: common.fiberPer100gG,
      sugarPer100gG: common.sugarPer100gG,
    }
  }

  const cached = getCachedFoodLookup(query)
  if (cached) return cached

  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
    query,
  )}&search_simple=1&action=process&json=1&page_size=5&fields=code,product_name,product_name_en,nutriments`

  let res = await fetch(url)
  if (!res.ok && res.status >= 500) {
    await new Promise((r) => setTimeout(r, 1500))
    res = await fetch(url)
  }
  if (!res.ok) throw new Error(`Open Food Facts request failed: ${res.status}`)
  const data = (await res.json()) as OffSearchResponse

  const candidates = (data.products ?? []).filter(
    (p) => typeof p.nutriments?.['energy-kcal_100g'] === 'number',
  )
  if (candidates.length === 0) return null

  // Real finding from live testing: Open Food Facts' free-text search ranking
  // is not reliable enough to trust the raw top hit — searching "olives"
  // returned "Alvalle Gazpacho" (a soup) as result #1. Prefer a candidate
  // whose product name genuinely contains the search term (tolerating simple
  // singular/plural mismatches, e.g. "olives" vs "olive") before falling
  // back to the raw top match.
  //
  // KNOWN, UNRESOLVED LIMITATION (found live, not fixed here — flagged to
  // the coordinator): Open Food Facts is a barcode/branded-product database,
  // not a generic whole-food nutrition database. For "olives" specifically,
  // even the top 15 results contain no genuine whole-olive product at all —
  // just olive OIL (~900 kcal/100g, wildly wrong for the fruit) and unrelated
  // items. Generic single-ingredient whole foods (raw fruit/veg, plain meats)
  // are exactly where this API is weakest; branded/packaged items match well.
  // The editable confirm step is the real safety net for this — a wrong
  // auto-match is visibly editable before anything is logged, never silently
  // trusted.
  const singularOrPlural = (w: string) => (w.endsWith('s') ? [w, w.slice(0, -1)] : [w, `${w}s`])
  const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean).flatMap(singularOrPlural)
  const nameMatch = candidates.find((p) => {
    const name = (p.product_name_en || p.product_name || '').toLowerCase()
    return queryWords.some((w) => name.includes(w))
  })

  const best = nameMatch ?? candidates[0]
  const n = best.nutriments!
  const result: OffMacros = {
    code: best.code ?? '',
    productName: best.product_name_en || best.product_name || query,
    caloriesPer100g: n['energy-kcal_100g'] ?? 0,
    proteinPer100gG: n['proteins_100g'] ?? 0,
    fatPer100gG: n['fat_100g'] ?? 0,
    carbsPer100gG: n['carbohydrates_100g'] ?? 0,
    fiberPer100gG: n['fiber_100g'],
    sugarPer100gG: n['sugars_100g'],
  }
  cacheFoodLookup(query, result)
  return result
}

/** Scales a per-100g macro profile to an estimated portion size in grams. */
export function scaleToPortion(off: OffMacros, grams: number) {
  const factor = grams / 100
  return {
    calories: Math.round(off.caloriesPer100g * factor),
    proteinG: Math.round(off.proteinPer100gG * factor * 10) / 10,
    fatG: Math.round(off.fatPer100gG * factor * 10) / 10,
    carbsG: Math.round(off.carbsPer100gG * factor * 10) / 10,
    fiberG: off.fiberPer100gG !== undefined ? Math.round(off.fiberPer100gG * factor * 10) / 10 : undefined,
    sugarG: off.sugarPer100gG !== undefined ? Math.round(off.sugarPer100gG * factor * 10) / 10 : undefined,
  }
}
