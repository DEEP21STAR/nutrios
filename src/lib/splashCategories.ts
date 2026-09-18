import { Camera, Utensils, Dumbbell, Weight, TrendingUp, Users, type LucideIcon } from 'lucide-react'

/**
 * The splash's category tour — six real features of the app, not generic diet-app clip art.
 * Icons come from lucide-react (a real, professionally-drawn icon set) rather than hand-authored
 * SVG paths — the hand-drawn shapes were the actual source of the "looks rubbish" feedback, not
 * the animation around them.
 */
export interface SplashCategory {
  id: string
  label: string
  color: string
  Icon: LucideIcon
}

export const SPLASH_CATEGORIES: SplashCategory[] = [
  { id: 'scan', label: 'AI FOOD SCAN', color: '#00e5a0', Icon: Camera },
  { id: 'meals', label: 'LOG MEALS', color: '#ffb800', Icon: Utensils },
  { id: 'train', label: 'TRAIN HARD', color: '#8b5cf6', Icon: Dumbbell },
  { id: 'weigh', label: 'WEIGH IN', color: '#10d8ff', Icon: Weight },
  { id: 'progress', label: 'TRACK PROGRESS', color: '#00e5a0', Icon: TrendingUp },
  { id: 'together', label: 'TOGETHER MODE', color: '#c040ff', Icon: Users },
]
