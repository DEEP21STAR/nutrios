import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Same pattern as Clarity's RadialProgress/CountUp: CSS `prefers-reduced-motion`
 * can never reach GSAP-driven or JS-scheduled motion, so every real animation
 * (ring fill, count-up, confetti) checks this explicitly at the JS level too.
 */
export function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function uid(): string {
  // crypto.randomUUID only exists in a secure context (HTTPS, or the literal
  // hostname "localhost") — Deep's real phone-testing path (Tailscale IP over
  // plain HTTP, e.g. http://100.120.128.22:5173) is neither, so it's silently
  // undefined there and this crashed every capture path (ConfirmLog,
  // resolveFoodItems, MenuCapture all call uid()). These ids are never sent to
  // Supabase — the DB assigns its own uuid — so a non-crypto fallback format
  // is safe; it's only ever used as a local/React key.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
