import { listMealsSince } from '@/lib/mealsRepo'
import { fetchGoals } from '@/lib/goalsRepo'
import { listWeightLogsSince, WeightTableMissingError } from '@/lib/weightRepo'
import { listProgressPhotos } from '@/lib/progressPhotosRepo'
import { sumMacros } from '@/lib/types'

/** Effectively "all-time" without needing a separate unbounded-range query function. */
const EPOCH = new Date(0).toISOString()

/**
 * Real local backup — a JSON file with everything NUTRYOS knows about this account, downloaded
 * straight to the device. Deliberately metadata-only for progress photos (date/note/weight, not
 * the image bytes): a signed URL baked into this file would expire and be meaningless days later,
 * and pulling every photo's binary into one JSON blob is a different, heavier feature than "a
 * quick local backup" — the images themselves stay recoverable from the app as long as the
 * account itself is (see accountLink.ts for the real gap that closes).
 */
export async function exportUserData(userId: string, displayName: string | null): Promise<object> {
  const [meals, goals, photos, weightLogs] = await Promise.all([
    listMealsSince(userId, EPOCH),
    fetchGoals(userId),
    listProgressPhotos(userId),
    listWeightLogsSince(userId, EPOCH).catch((err) => {
      if (err instanceof WeightTableMissingError) return []
      throw err
    }),
  ])

  return {
    exportedAt: new Date().toISOString(),
    app: 'NUTRYOS',
    displayName,
    goals,
    meals: meals.map((m) => ({
      loggedAt: m.loggedAt,
      items: m.items,
      totals: sumMacros(m.items),
      isEatingOut: m.isEatingOut,
      restaurantName: m.restaurantName,
    })),
    weightLogs: weightLogs.map((w) => ({ loggedAt: w.loggedAt, weightKg: w.weightKg })),
    progressPhotos: photos.map((p) => ({ takenAt: p.takenAt, weightKg: p.weightKg, note: p.note })),
  }
}

export function downloadJson(data: object, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
