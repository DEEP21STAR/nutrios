import { useState } from 'react'
import { TodayRing } from '@/components/TodayRing'
import { calculateGoals, type ActivityLevel, type GoalDirection, type OnboardingAnswers, type Sex } from '@/lib/bmr'
import type { Goals } from '@/lib/types'

const STEPS = ['welcome', 'name', 'sex', 'age', 'height', 'weight', 'target', 'activity', 'goal', 'review'] as const
type Step = (typeof STEPS)[number]

// Gendered personalization (Deep's real request) — once a sex is picked, every step after it
// (age onward, including the progress bar and Continue button) picks up this accent instead of
// the default emerald, so the rest of onboarding reads as personalized rather than generic.
// Welcome/name/sex themselves stay the neutral default since there's nothing to personalize yet.
const MALE_COLOR = '#3b9dff'
const FEMALE_COLOR = '#ff5ea8'
const DEFAULT_COLOR = 'var(--color-accent-health)'

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string; hint: string }[] = [
  { value: 'sedentary', label: 'Sedentary', hint: 'Little or no exercise' },
  { value: 'light', label: 'Lightly active', hint: '1-3 workouts a week' },
  { value: 'moderate', label: 'Moderately active', hint: '3-5 workouts a week' },
  { value: 'very_active', label: 'Very active', hint: '6-7 workouts a week' },
]

/**
 * First-run setup wizard — real Mifflin-St Jeor BMR/TDEE calculation (see
 * lib/bmr.ts), not a placeholder. Shown once, before the main app, when no
 * `goals` row exists yet for this user (checked in App.tsx). Same visual
 * language as the rest of NUTRYOS (glass cards, starfield behind, neon
 * ring) rather than a generic form — the final step renders the exact same
 * TodayRing component the user sees every day after this, filled with
 * their real computed targets, so onboarding ends on the object it was
 * building toward the whole time.
 */
export function OnboardingWizard({ onComplete }: { onComplete: (goals: Goals, name: string) => void }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [name, setName] = useState('')
  const [sex, setSex] = useState<Sex | null>(null)
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null)
  const [goalRate, setGoalRate] = useState(0.5)

  const step: Step = STEPS[stepIndex]
  const progressPct = ((stepIndex + 1) / STEPS.length) * 100
  const themeColor = sex ? (sex === 'male' ? MALE_COLOR : FEMALE_COLOR) : DEFAULT_COLOR

  const weightNum = parseFloat(weightKg)
  const targetWeightNum = parseFloat(targetWeightKg)
  // Direction is implied by current vs target weight, but "maintain" needs an explicit choice
  // since equal weights alone can't distinguish "recomp" from "just checking calories."
  const impliedDirection: GoalDirection | null =
    Number.isFinite(weightNum) && Number.isFinite(targetWeightNum)
      ? targetWeightNum < weightNum - 0.5
        ? 'lose'
        : targetWeightNum > weightNum + 0.5
          ? 'gain'
          : 'maintain'
      : null

  const answers: OnboardingAnswers | null =
    sex && age && heightCm && weightKg && activityLevel && impliedDirection
      ? {
          sex,
          age: parseFloat(age),
          heightCm: parseFloat(heightCm),
          weightKg: weightNum,
          activityLevel,
          goalDirection: impliedDirection,
          goalRateKgPerWeek: goalRate,
        }
      : null

  const computedGoals = answers ? calculateGoals(answers) : null

  function next() {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1)
  }
  function back() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1)
  }

  const canAdvance: Record<Step, boolean> = {
    welcome: true,
    // Skippable on purpose — WhetuFooter already falls back to "you" when this is blank, so a
    // name shouldn't gate access to the rest of onboarding the way the BMR-required fields do.
    name: true,
    sex: sex !== null,
    age: parseFloat(age) > 0 && parseFloat(age) < 120,
    height: parseFloat(heightCm) > 50 && parseFloat(heightCm) < 260,
    weight: parseFloat(weightKg) > 20 && parseFloat(weightKg) < 400,
    target: parseFloat(targetWeightKg) > 20 && parseFloat(targetWeightKg) < 400,
    activity: activityLevel !== null,
    goal: true,
    review: true,
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-bg-primary text-text-primary">
      <div className="glass sticky top-0 z-10 flex flex-col gap-2 px-4 pt-[calc(env(safe-area-inset-top,0px)+12px)] pb-3">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-[width,background-color] duration-300 ease-out"
            style={{ width: `${progressPct}%`, background: themeColor, boxShadow: `0 0 12px 1px ${themeColor}` }}
          />
        </div>
        <p className="text-caption text-text-tertiary">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
      </div>

      <div className="mx-4 mt-6 flex flex-1 flex-col">
        {step === 'welcome' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            <div
              className="grid h-16 w-16 place-items-center rounded-full"
              style={{ background: 'rgb(0 229 160 / 0.12)', boxShadow: '0 0 24px 4px var(--glow-health)' }}
            >
              <span className="text-3xl" aria-hidden>
                🎯
              </span>
            </div>
            <h1 className="text-title">Let's set your goals</h1>
            <p className="max-w-xs text-body text-text-tertiary">
              A few quick questions — your age, weight, and activity level — and NUTRYOS builds a
              real daily calorie and macro target just for you.
            </p>
          </div>
        )}

        {step === 'name' && (
          <StepCard title="What should we call you?" subtitle="Shows up in the little signature at the bottom of your screen — totally optional.">
            <input
              type="text"
              enterKeyHint="next"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') next()
              }}
              placeholder="Your name"
              maxLength={40}
              autoFocus
              className="rounded-xl border border-white/10 bg-bg-secondary px-4 py-3 text-body text-text-primary outline-none focus:border-accent-health placeholder:text-text-tertiary"
            />
          </StepCard>
        )}

        {step === 'sex' && (
          <StepCard title="Let's personalize your plan" subtitle="This helps us calculate your real daily energy needs — and colors the rest of setup just for you.">
            <div className="grid grid-cols-2 gap-3">
              <ChoiceButton selected={sex === 'male'} onClick={() => setSex('male')} color={MALE_COLOR}>
                Male
              </ChoiceButton>
              <ChoiceButton selected={sex === 'female'} onClick={() => setSex('female')} color={FEMALE_COLOR}>
                Female
              </ChoiceButton>
            </div>
          </StepCard>
        )}

        {step === 'age' && (
          <StepCard title="How old are you?" subtitle="Metabolism shifts with age — this keeps your target accurate.">
            <NumberField value={age} onChange={setAge} placeholder="Age" suffix="years" color={themeColor} />
          </StepCard>
        )}

        {step === 'height' && (
          <StepCard title="How tall are you?" subtitle="Used in the same formula as your doctor's BMR calculation.">
            <NumberField value={heightCm} onChange={setHeightCm} placeholder="Height" suffix="cm" color={themeColor} />
          </StepCard>
        )}

        {step === 'weight' && (
          <StepCard title="What's your current weight?" subtitle="Just an estimate is fine — you can always adjust later.">
            <NumberField value={weightKg} onChange={setWeightKg} placeholder="Weight" suffix="kg" color={themeColor} />
          </StepCard>
        )}

        {step === 'target' && (
          <StepCard title="What's your target weight?" subtitle="Same number as now is fine if you just want to maintain.">
            <NumberField value={targetWeightKg} onChange={setTargetWeightKg} placeholder="Target weight" suffix="kg" color={themeColor} />
          </StepCard>
        )}

        {step === 'activity' && (
          <StepCard title="How active are you?" subtitle="Outside of intentional workouts — your typical week.">
            <div className="flex flex-col gap-2">
              {ACTIVITY_OPTIONS.map((opt) => (
                <ChoiceButton key={opt.value} selected={activityLevel === opt.value} onClick={() => setActivityLevel(opt.value)} color={themeColor}>
                  <div className="text-left">
                    <div>{opt.label}</div>
                    <div className="text-caption text-text-tertiary">{opt.hint}</div>
                  </div>
                </ChoiceButton>
              ))}
            </div>
          </StepCard>
        )}

        {step === 'goal' && (
          <StepCard
            title="How fast?"
            subtitle={
              impliedDirection === 'maintain'
                ? "Your target matches your current weight — we'll aim to maintain."
                : `Based on your numbers, this looks like a ${impliedDirection === 'lose' ? 'weight-loss' : 'weight-gain'} goal.`
            }
          >
            {impliedDirection !== 'maintain' && (
              <div className="flex flex-col gap-2">
                {[0.25, 0.5, 0.75, 1].map((rate) => (
                  <ChoiceButton key={rate} selected={goalRate === rate} onClick={() => setGoalRate(rate)} color={themeColor}>
                    {rate} kg / week {rate <= 0.5 ? '(steady, recommended)' : rate >= 1 ? '(aggressive)' : ''}
                  </ChoiceButton>
                ))}
              </div>
            )}
          </StepCard>
        )}

        {step === 'review' && computedGoals && (
          <StepCard title="Your plan is ready" subtitle="This is exactly what you'll see on Today, every day.">
            <div className="flex justify-center py-2">
              <TodayRing totals={{ calories: 0, proteinG: 0, fatG: 0, carbsG: 0 }} goals={computedGoals} />
            </div>
          </StepCard>
        )}
      </div>

      <div className="glass sticky bottom-0 flex gap-3 px-4 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
        {stepIndex > 0 && (
          <button
            onClick={back}
            className="rounded-xl border border-white/10 px-5 py-3 text-body text-text-secondary"
          >
            Back
          </button>
        )}
        <button
          onClick={() => (step === 'review' ? computedGoals && onComplete(computedGoals, name.trim()) : next())}
          disabled={!canAdvance[step]}
          className="flex-1 rounded-xl py-3 text-body font-semibold text-bg-primary transition-colors disabled:opacity-30"
          style={{ background: themeColor, boxShadow: `0 0 20px -4px ${themeColor}` }}
        >
          {step === 'review' ? 'Start using NUTRYOS' : 'Continue'}
        </button>
      </div>
    </div>
  )
}

function StepCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="glass-card flex flex-1 flex-col gap-5 p-5">
      <div>
        <h2 className="text-title">{title}</h2>
        <p className="mt-1 text-caption text-text-tertiary">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function ChoiceButton({
  selected,
  onClick,
  children,
  color = 'var(--color-accent-health)',
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border px-4 py-3 text-body transition-colors"
      style={
        selected
          ? { borderColor: color, background: `color-mix(in srgb, ${color} 12%, transparent)`, color: 'var(--color-text-primary)' }
          : { borderColor: 'rgb(255 255 255 / 0.1)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-secondary)' }
      }
    >
      {children}
    </button>
  )
}

function NumberField({
  value,
  onChange,
  placeholder,
  suffix,
  color = 'var(--color-accent-health)',
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  suffix: string
  color?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div
      className="flex items-center gap-2 rounded-xl border bg-bg-secondary px-4 py-3 transition-colors"
      style={{ borderColor: focused ? color : 'rgb(255 255 255 / 0.1)' }}
    >
      <input
        type="number"
        inputMode="decimal"
        enterKeyHint="done"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        placeholder={placeholder}
        className="flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-text-tertiary"
      />
      <span className="text-caption text-text-tertiary">{suffix}</span>
    </div>
  )
}
