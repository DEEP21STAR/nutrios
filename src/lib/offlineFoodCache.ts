/**
 * Persistent local cache of every real Open Food Facts lookup result — built alongside
 * commonFoods.ts (2026-09-18) so "fully offline" doesn't quietly break at the macro-lookup step
 * one turn after vision succeeds. Once you've looked up a food once (online), it resolves
 * offline every time after, with the real result, not a guess. localStorage rather than
 * IndexedDB — the payload here is tiny (a handful of numbers per entry) and doesn't need
 * IndexedDB's async/transaction machinery.
 */
import type { OffMacros } from '@/lib/openFoodFacts'

const STORAGE_KEY = 'nutrios.offlineFoodCache.v1'
const MAX_ENTRIES = 500 // generous; a personal app's real vocabulary of distinct foods is small

function normalize(query: string): string {
  return query.toLowerCase().trim()
}

function readCache(): Record<string, OffMacros> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, OffMacros>) : {}
  } catch {
    return {}
  }
}

function writeCache(cache: Record<string, OffMacros>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // Storage full or unavailable (private browsing, quota) — caching is a nice-to-have,
    // never worth breaking the actual lookup over.
  }
}

export function getCachedFoodLookup(query: string): OffMacros | null {
  const cache = readCache()
  return cache[normalize(query)] ?? null
}

export function cacheFoodLookup(query: string, result: OffMacros) {
  const cache = readCache()
  const key = normalize(query)
  cache[key] = result

  const keys = Object.keys(cache)
  if (keys.length > MAX_ENTRIES) {
    // Drop the oldest-inserted entries first (object key insertion order in JS is stable) —
    // simple LRU-ish eviction, not worth a more precise scheme for a few hundred entries.
    for (const oldKey of keys.slice(0, keys.length - MAX_ENTRIES)) {
      delete cache[oldKey]
    }
  }
  writeCache(cache)
}
