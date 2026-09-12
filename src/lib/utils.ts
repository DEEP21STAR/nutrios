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
  return crypto.randomUUID()
}
