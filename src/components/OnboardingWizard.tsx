import { useState } from 'react'
import { TodayRing } from '@/components/TodayRing'
import { calculateGoals, type ActivityLevel, type GoalDirection, type OnboardingAnswers, type Sex } from '@/lib/bmr'
import type { Goals } from '@/lib/types'

const STEPS = ['sex', 'age', 'height', 'weight', 'target', 'activity', 'goal', 'review'] as const
type Step = (typeof STEPS)[number]

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
 * language as the rest of NUTRIOS (glass cards, starfield behind, neon
 * ring) rather than a generic form — the final step renders the exact same
 * TodayRing component the user sees every day after this, filled with
 * their real computed targets, so onboarding ends on the object it was
 * building toward the whole time.
 */
export function OnboardingWizard({ onComplete }: { onComplete: (goals: Goals) => void }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [sex, setSex] = useState<Sex | null>(null)
  const [age, setAge] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [targetWeightKg, setTargetWeightKg] = useState('')
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null)
  const [goalRate, setGoalRate] = useState(0.5)

  const step: Step = STEPS[stepIndex]
  const progressPct = ((stepIndex + 1) / STEPS.length) * 100

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
            className="h-full rounded-full bg-accent-health transition-[width] duration-300 ease-out"
            style={{ width: `${progressPct}%`, boxShadow: '0 0 12px 1px var(--glow-health)' }}
          />
        </div>
        <p className="text-caption text-text-tertiary">
          Step {stepIndex + 1} of {STEPS.length}
        </p>
      </div>

      <div className="mx-4 mt-6 flex flex-1 flex-col">
        {step === 'sex' && (
          <StepCard title="Let's personalize your plan" subtitle="This helps us calculate your real daily energy needs.">
            <div className="grid grid-cols-2 gap-3">
              {(['male', 'female'] as const).map((opt) => (
                <ChoiceButton key={opt} selected={sex === opt} onClick={() => setSex(opt)}>
                  {opt === 'male' ? 'Male' : 'Female'}
                </ChoiceButton>
              ))}
            </div>
          </StepCard>
        )}

        {step === 'age' && (
          <StepCard title="How old are you?" subtitle="Metabolism shifts with age — this keeps your target accurate.">
            <NumberField value={age} onChange={setAge} placeholder="Age" suffix="years" />
          </StepCard>
        )}

        {step === 'height' && (
          <StepCard title="How tall are you?" subtitle="Used in the same formula as your doctor's BMR calculation.">
            <NumberField value={heightCm} onChange={setHeightCm} placeholder="Height" suffix="cm" />
          </StepCard>
        )}

        {step === 'weight' && (
          <StepCard title="What's your current weight?" subtitle="Just an estimate is fine — you can always adjust later.">
            <NumberField value={weightKg} onChange={setWeightKg} placeholder="Weight" suffix="kg" />
          </StepCard>
        )}

        {step === 'target' && (
          <StepCard title="What's your target weight?" subtitle="Same number as now is fine if you just want to maintain.">
            <NumberField value={targetWeightKg} onChange={setTargetWeightKg} placeholder="Target weight" suffix="kg" />
          </StepCard>
        )}

        {step === 'activity' && (
          <StepCard title="How active are you?" subtitle="Outside of intentional workouts — your typical week.">
            <div className="flex flex-col gap-2">
              {ACTIVITY_OPTIONS.map((opt) => (
                <ChoiceButton key={opt.value} selected={activityLevel === opt.value} onClick={() => setActivityLevel(opt.value)}>
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
                  <ChoiceButton key={rate} selected={goalRate === rate} onClick={() => setGoalRate(rate)}>
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
          onClick={() => (step === 'review' ? computedGoals && onComplete(computedGoals) : next())}
          disabled={!canAdvance[step]}
          className="flex-1 rounded-xl bg-accent-health py-3 text-body font-semibold text-bg-primary disabled:opacity-30"
        >
          {step === 'review' ? 'Start using NUTRIOS' : 'Continue'}
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
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-body transition-colors ${
        selected
          ? 'border-accent-health bg-accent-health/10 text-text-primary'
          : 'border-white/10 bg-bg-secondary text-text-secondary'
      }`}
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
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  suffix: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-bg-secondary px-4 py-3">
      <input
        type="number"
        inputMode="decimal"
        enterKeyHint="done"
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
