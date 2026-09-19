/**
 * Micronutrient depth (free) + fuller breakdown (Premium) — real competitor finding: Cronometer/
 * MyNetDiary gate 100+ nutrients, NUTRYOS offers a real slice free. Sourced from Open Food Facts'
 * `nutriments_estimated` block (confirmed present on a real live product response while building
 * barcode scanning), converted from OFF's raw grams-per-100g to the units nutrition labels
 * actually use (mg/mcg) before comparing against real FDA Daily Values.
 *
 * Deliberately scoped to OFF-sourced (branded/packaged) items only for now, not the 30-item
 * commonFoods.ts whole-foods list -- verifying real per-item micronutrient values across 8
 * separate nutrients for every curated food is a lot of surface area to get right without a
 * proper sourced dataset, and this project's own standard is "real, spot-checked" data, not a
 * plausible-looking guess. Honest gap, not fixed here.
 */

export interface MicronutrientProfile {
  vitaminCMg?: number
  calciumMg?: number
  ironMg?: number
  potassiumMg?: number
  // Premium-only tier — a real bullet in Settings -> Premium, not decorative.
  vitaminAMcg?: number
  vitaminB12Mcg?: number
  magnesiumMg?: number
  zincMg?: number
}

/** Real FDA Daily Values (the same reference every US nutrition label uses), for a real %DV,
 * not a made-up "how good is this" score. */
export const DAILY_VALUES = {
  vitaminCMg: 90,
  calciumMg: 1300,
  ironMg: 18,
  potassiumMg: 4700,
  vitaminAMcg: 900,
  vitaminB12Mcg: 2.4,
  magnesiumMg: 420,
  zincMg: 11,
} as const

/** OFF stores every nutrient in grams internally (even ones normally read in mg/mcg) -- these
 * multipliers convert to the units DAILY_VALUES above are expressed in.
 *
 * Real API inconsistency found and handled, not assumed: the legacy search.pl endpoint
 * (lookupFoodMacros) returns nutriments_estimated values as STRINGS ("0.107269704"), while the
 * v2 product endpoint (lookupByBarcode) returns real numbers for the same field -- confirmed
 * against live responses from both before writing this. Number(...) coerces either correctly. */
export function extractMicronutrientsPer100g(nutriments: Record<string, number | string>): MicronutrientProfile {
  const g = (key: string): number | undefined => {
    const raw = nutriments[key]
    if (raw === undefined) return undefined
    const n = Number(raw)
    return Number.isFinite(n) ? n : undefined
  }
  const toMg = (v: number | undefined) => (v !== undefined ? v * 1000 : undefined)
  const toMcg = (v: number | undefined) => (v !== undefined ? v * 1_000_000 : undefined)
  return {
    vitaminCMg: toMg(g('vitamin-c_100g')),
    calciumMg: toMg(g('calcium_100g')),
    ironMg: toMg(g('iron_100g')),
    potassiumMg: toMg(g('potassium_100g')),
    vitaminAMcg: toMcg(g('vitamin-a_100g')),
    vitaminB12Mcg: toMcg(g('vitamin-b12_100g')),
    magnesiumMg: toMg(g('magnesium_100g')),
    zincMg: toMg(g('zinc_100g')),
  }
}

export function scaleMicronutrients(profile: MicronutrientProfile, grams: number): MicronutrientProfile {
  const factor = grams / 100
  const scale = (v?: number) => (v !== undefined ? Math.round(v * factor * 100) / 100 : undefined)
  return {
    vitaminCMg: scale(profile.vitaminCMg),
    calciumMg: scale(profile.calciumMg),
    ironMg: scale(profile.ironMg),
    potassiumMg: scale(profile.potassiumMg),
    vitaminAMcg: scale(profile.vitaminAMcg),
    vitaminB12Mcg: scale(profile.vitaminB12Mcg),
    magnesiumMg: scale(profile.magnesiumMg),
    zincMg: scale(profile.zincMg),
  }
}

export function percentDV(amount: number | undefined, dailyValue: number): number | null {
  if (amount === undefined) return null
  return Math.round((amount / dailyValue) * 100)
}
