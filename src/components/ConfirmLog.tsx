import { useState } from 'react'
import type { FoodItem } from '@/lib/types'
import { sumMacros, type Meal } from '@/lib/types'
import { uid } from '@/lib/utils'

/**
 * Core-loop step 4: editable confirm-before-log step. The vision model +
 * Open Food Facts lookup pre-fill everything, but nothing is logged until
 * the user taps confirm — every field (name, grams, and the derived macros)
 * is editable in case identification or the macro lookup was wrong. This is
 * also the manual-fallback surface: if photo ID/lookup failed entirely, the
 * item list starts empty and the user types a food in by hand.
 */
export function ConfirmLog({
  photoDataUrl,
  initialItems,
  onConfirm,
  onCancel,
}: {
  photoDataUrl: string
  initialItems: FoodItem[]
  onConfirm: (meal: Meal) => void
  onCancel: () => void
}) {
  const [items, setItems] = useState<FoodItem[]>(initialItems)

  function updateItem(id: string, patch: Partial<FoodItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  function addBlankItem() {
    setItems((prev) => [
      ...prev,
      { id: uid(), name: '', estimatedGrams: 100, calories: 0, proteinG: 0, fatG: 0, carbsG: 0 },
    ])
  }

  const totals = sumMacros(items)

  function confirm() {
    onConfirm({
      id: uid(),
      photoDataUrl,
      items: items.filter((it) => it.name.trim().length > 0),
      loggedAt: new Date().toISOString(),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-slate-900 text-slate-100">
      <div className="flex items-center justify-between p-4">
        <button onClick={onCancel} className="text-sm text-slate-400">
          Cancel
        </button>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Confirm meal</h2>
        <div className="w-12" />
      </div>

      <img src={photoDataUrl} alt="Captured meal" className="mx-4 h-48 rounded-2xl object-cover" />

      <div className="mt-4 flex flex-col gap-3 px-4">
        {items.length === 0 && (
          <p className="text-center text-sm text-slate-500">No items identified — add one manually below.</p>
        )}
        {items.map((item) => (
          <div key={item.id} className="rounded-xl bg-slate-800 p-3">
            <div className="flex items-center gap-2">
              <input
                value={item.name}
                onChange={(e) => updateItem(item.id, { name: e.target.value })}
                placeholder="Food name"
                className="min-w-0 flex-1 rounded bg-slate-700 px-2 py-1 text-sm"
              />
              <input
                type="number"
                value={item.estimatedGrams}
                onChange={(e) => updateItem(item.id, { estimatedGrams: Number(e.target.value) })}
                className="w-16 rounded bg-slate-700 px-2 py-1 text-right text-sm"
              />
              <span className="text-xs text-slate-400">g</span>
              <button onClick={() => removeItem(item.id)} className="text-slate-500" aria-label="Remove item">
                ✕
              </button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-xs">
              <MacroField label="kcal" value={item.calories} onChange={(v) => updateItem(item.id, { calories: v })} />
              <MacroField label="P g" value={item.proteinG} onChange={(v) => updateItem(item.id, { proteinG: v })} />
              <MacroField label="F g" value={item.fatG} onChange={(v) => updateItem(item.id, { fatG: v })} />
              <MacroField label="C g" value={item.carbsG} onChange={(v) => updateItem(item.id, { carbsG: v })} />
            </div>
          </div>
        ))}
        <button onClick={addBlankItem} className="rounded-xl border border-dashed border-slate-600 py-2 text-sm text-slate-400">
          + Add item manually
        </button>
      </div>

      <div className="mt-auto border-t border-slate-800 p-4">
        <div className="mb-3 flex justify-between text-sm text-slate-300">
          <span>Total</span>
          <span>
            {Math.round(totals.calories)} kcal · P{Math.round(totals.proteinG)} F{Math.round(totals.fatG)} C
            {Math.round(totals.carbsG)}
          </span>
        </div>
        <button
          onClick={confirm}
          disabled={items.filter((it) => it.name.trim()).length === 0}
          className="w-full rounded-full bg-emerald-500 py-3 font-semibold text-slate-900 disabled:opacity-40"
        >
          Log this meal
        </button>
      </div>
    </div>
  )
}

function MacroField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col items-center gap-1 text-slate-400">
      {label}
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded bg-slate-700 px-1 py-1 text-center text-slate-100"
      />
    </label>
  )
}
