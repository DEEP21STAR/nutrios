/**
 * Curated common whole-foods dataset (2026-09-18, built overnight while Deep slept) — real
 * USDA FoodData Central reference values per 100g, spot-checked against USDA-sourced sources
 * before writing this file, not invented. Exists for two separate real reasons, found the same
 * night this was built:
 *
 *   1. Offline: Open Food Facts (the online lookup) needs internet. Vision (Ollama/Gemini/
 *      on-device) can now all work without this laptop, but the macro-lookup step was still a
 *      silent single point of failure — "fully offline" would have broken one step later.
 *   2. Accuracy: Open Food Facts is a barcode/branded-product database, not a whole-food
 *      nutrition database — openFoodFacts.ts's own header comment already documented "olives"
 *      returning olive OIL as the top match (~900 kcal/100g, wildly wrong for the fruit).
 *      "banana" returning 0 macros in tonight's own live testing is the same root problem.
 *      Checked FIRST here, before ever hitting the network, this fixes both the offline case
 *      AND the online accuracy case for exactly the foods OFF is weakest at.
 *
 * Deliberately modest (~30 items) — the highest-frequency staples, not an attempt to replace
 * Open Food Facts for branded/packaged food, which it's genuinely good at. Matching is a simple
 * substring/keyword check (see matchCommonFood), same tolerance style as openFoodFacts.ts's own
 * singular/plural handling.
 */

export interface CommonFood {
  name: string
  keywords: string[]
  caloriesPer100g: number
  proteinPer100gG: number
  fatPer100gG: number
  carbsPer100gG: number
}

export const COMMON_FOODS: CommonFood[] = [
  { name: 'Banana', keywords: ['banana'], caloriesPer100g: 89, proteinPer100gG: 1.1, fatPer100gG: 0.3, carbsPer100gG: 22.8 },
  { name: 'Apple', keywords: ['apple'], caloriesPer100g: 52, proteinPer100gG: 0.3, fatPer100gG: 0.2, carbsPer100gG: 13.8 },
  { name: 'Orange', keywords: ['orange'], caloriesPer100g: 47, proteinPer100gG: 0.9, fatPer100gG: 0.1, carbsPer100gG: 11.8 },
  { name: 'Boiled egg', keywords: ['egg'], caloriesPer100g: 155, proteinPer100gG: 12.6, fatPer100gG: 10.6, carbsPer100gG: 1.1 },
  { name: 'Chicken breast, cooked', keywords: ['chicken breast', 'grilled chicken', 'chicken'], caloriesPer100g: 165, proteinPer100gG: 31, fatPer100gG: 3.6, carbsPer100gG: 0 },
  { name: 'White rice, cooked', keywords: ['white rice', 'rice'], caloriesPer100g: 130, proteinPer100gG: 2.7, fatPer100gG: 0.3, carbsPer100gG: 28.2 },
  { name: 'Brown rice, cooked', keywords: ['brown rice'], caloriesPer100g: 123, proteinPer100gG: 2.7, fatPer100gG: 1, carbsPer100gG: 25.6 },
  { name: 'White bread', keywords: ['white bread', 'toast', 'bread'], caloriesPer100g: 265, proteinPer100gG: 9, fatPer100gG: 3.2, carbsPer100gG: 49 },
  { name: 'Whole wheat bread', keywords: ['whole wheat bread', 'wholemeal bread'], caloriesPer100g: 247, proteinPer100gG: 13, fatPer100gG: 3.4, carbsPer100gG: 41 },
  { name: 'Broccoli, cooked', keywords: ['broccoli'], caloriesPer100g: 35, proteinPer100gG: 2.4, fatPer100gG: 0.4, carbsPer100gG: 7.2 },
  { name: 'Spinach, cooked', keywords: ['spinach'], caloriesPer100g: 23, proteinPer100gG: 2.9, fatPer100gG: 0.4, carbsPer100gG: 3.8 },
  { name: 'Carrot, raw', keywords: ['carrot'], caloriesPer100g: 41, proteinPer100gG: 0.9, fatPer100gG: 0.2, carbsPer100gG: 9.6 },
  { name: 'Potato, boiled', keywords: ['potato'], caloriesPer100g: 87, proteinPer100gG: 1.9, fatPer100gG: 0.1, carbsPer100gG: 20.1 },
  { name: 'Sweet potato, cooked', keywords: ['sweet potato', 'kumara'], caloriesPer100g: 90, proteinPer100gG: 2, fatPer100gG: 0.1, carbsPer100gG: 20.7 },
  { name: 'Salmon, cooked', keywords: ['salmon'], caloriesPer100g: 208, proteinPer100gG: 20, fatPer100gG: 13, carbsPer100gG: 0 },
  { name: 'Beef mince, cooked', keywords: ['beef mince', 'ground beef', 'mince'], caloriesPer100g: 250, proteinPer100gG: 26, fatPer100gG: 15, carbsPer100gG: 0 },
  { name: 'Steak, cooked', keywords: ['steak', 'beef steak'], caloriesPer100g: 271, proteinPer100gG: 25, fatPer100gG: 19, carbsPer100gG: 0 },
  { name: 'Bacon, cooked', keywords: ['bacon'], caloriesPer100g: 541, proteinPer100gG: 37, fatPer100gG: 42, carbsPer100gG: 1.4 },
  { name: 'Milk, whole', keywords: ['milk'], caloriesPer100g: 61, proteinPer100gG: 3.2, fatPer100gG: 3.3, carbsPer100gG: 4.8 },
  { name: 'Greek yoghurt, plain', keywords: ['greek yoghurt', 'greek yogurt', 'yoghurt', 'yogurt'], caloriesPer100g: 59, proteinPer100gG: 10, fatPer100gG: 0.4, carbsPer100gG: 3.6 },
  { name: 'Cheddar cheese', keywords: ['cheddar', 'cheese'], caloriesPer100g: 403, proteinPer100gG: 25, fatPer100gG: 33, carbsPer100gG: 1.3 },
  { name: 'Avocado', keywords: ['avocado'], caloriesPer100g: 160, proteinPer100gG: 2, fatPer100gG: 14.7, carbsPer100gG: 8.5 },
  { name: 'Almonds', keywords: ['almond'], caloriesPer100g: 579, proteinPer100gG: 21.2, fatPer100gG: 49.9, carbsPer100gG: 21.6 },
  { name: 'Peanut butter', keywords: ['peanut butter'], caloriesPer100g: 588, proteinPer100gG: 25, fatPer100gG: 50, carbsPer100gG: 20 },
  { name: 'Oats, cooked', keywords: ['oats', 'oatmeal', 'porridge'], caloriesPer100g: 71, proteinPer100gG: 2.5, fatPer100gG: 1.5, carbsPer100gG: 12 },
  { name: 'Pasta, cooked', keywords: ['pasta', 'spaghetti', 'noodles'], caloriesPer100g: 131, proteinPer100gG: 5.1, fatPer100gG: 1.1, carbsPer100gG: 25 },
  { name: 'Tomato', keywords: ['tomato'], caloriesPer100g: 18, proteinPer100gG: 0.9, fatPer100gG: 0.2, carbsPer100gG: 3.9 },
  { name: 'Onion, raw', keywords: ['onion'], caloriesPer100g: 40, proteinPer100gG: 1.1, fatPer100gG: 0.1, carbsPer100gG: 9.3 },
  { name: 'Cabbage, cooked', keywords: ['cabbage'], caloriesPer100g: 23, proteinPer100gG: 1.3, fatPer100gG: 0.1, carbsPer100gG: 5.4 },
  { name: 'Mushroom, cooked', keywords: ['mushroom'], caloriesPer100g: 28, proteinPer100gG: 3.9, fatPer100gG: 0.5, carbsPer100gG: 5.3 },
]

/** Same tolerance style as openFoodFacts.ts's singular/plural handling — a plain substring
 * check against each food's keyword list, tried before ever touching the network. */
export function matchCommonFood(query: string): CommonFood | null {
  const q = query.toLowerCase().trim()
  for (const food of COMMON_FOODS) {
    if (food.keywords.some((k) => q.includes(k) || k.includes(q))) {
      return food
    }
  }
  return null
}
