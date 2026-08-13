import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { api, ApiError } from '@/lib/api'
import { saveOnboardingFlag } from '@/lib/onboarding'
import { EQUIPMENT, STARTER_EXERCISES, type Equipment } from '@/lib/starterExercises'
import { cn } from '@/lib/utils'
import { AppearanceStep } from './AppearanceStep'
import { ExercisesStep } from './ExercisesStep'
import { FinishStep } from './FinishStep'
import { UnitsStep } from './UnitsStep'
import { WelcomeStep } from './WelcomeStep'

export interface SeedSummary {
  created: number
  existed: number
  failed: string[]
}

const STEP_COUNT = 5
const EXERCISES_STEP = 3
const FINISH_STEP = 4

/**
 * The first-run questionnaire: a full-screen takeover that replaces the app
 * shell until completed or skipped (see RootLayout). Units and appearance
 * apply live through their existing stores; the exercises step seeds the
 * starter library through the regular create endpoint, treating 409s as
 * "already exists" so replaying the wizard never duplicates anything.
 */
export function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState(0)
  const [equipment, setEquipment] = useState<Set<Equipment>>(() => new Set(EQUIPMENT))
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(STARTER_EXERCISES.map((exercise) => exercise.name)),
  )

  const seed = useMutation({
    mutationFn: async (names: Set<string>): Promise<SeedSummary> => {
      const chosen = STARTER_EXERCISES.filter((exercise) => names.has(exercise.name))
      const results = await Promise.allSettled(
        chosen.map((exercise) =>
          api.exercises.create({ name: exercise.name, category: exercise.category }),
        ),
      )
      const summary: SeedSummary = { created: 0, existed: 0, failed: [] }
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') summary.created += 1
        else if (result.reason instanceof ApiError && result.reason.status === 409)
          summary.existed += 1
        else summary.failed.push(chosen[index].name)
      })
      return summary
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercises'] }),
  })

  const toggleEquipment = (kind: Equipment) => {
    const enabling = !equipment.has(kind)
    const nextEquipment = new Set(equipment)
    const nextSelected = new Set(selected)
    if (enabling) nextEquipment.add(kind)
    else nextEquipment.delete(kind)
    for (const exercise of STARTER_EXERCISES) {
      if (exercise.equipment !== kind) continue
      if (enabling) nextSelected.add(exercise.name)
      else nextSelected.delete(exercise.name)
    }
    setEquipment(nextEquipment)
    setSelected(nextSelected)
  }

  const toggleName = (name: string) => {
    const next = new Set(selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setSelected(next)
  }

  const skip = () => {
    saveOnboardingFlag('done')
    onDone()
  }

  const finish = (to: '/' | '/workouts') => {
    saveOnboardingFlag('done')
    onDone()
    void navigate({ to })
  }

  const stepChangedAt = useRef(0)

  const goTo = (target: (current: number) => number) => {
    stepChangedAt.current = Date.now()
    setStep((current) => Math.min(Math.max(target(current), 0), FINISH_STEP))
  }

  const next = async () => {
    if (step === EXERCISES_STEP && selected.size > 0 && seed.data === undefined) {
      // The Next button keeps its screen position across steps, so a double-
      // click's second activation lands on the following step's button — here
      // that would fire the seed before the user ever saw the selection.
      // Only the seed needs this debounce: plain navigation is safe (bounds
      // are clamped, and a skipped preference step is one Back-click away).
      if (Date.now() - stepChangedAt.current < 300) return
      await seed.mutateAsync(selected)
    }
    goTo((current) => current + 1)
  }

  const retrySeed = () => {
    // Try-again from an all-failed finish: clear the mutation so its stale
    // summary doesn't leak into the next attempt, then return to the step.
    seed.reset()
    goTo(() => EXERCISES_STEP)
  }

  const nextLabel = () => {
    if (step === 0) return 'Get started'
    if (step !== EXERCISES_STEP) return 'Next'
    if (seed.isPending) return 'Adding…'
    return selected.size > 0 ? `Add ${selected.size} exercises` : 'Continue without exercises'
  }

  return (
    <div
      className="flex min-h-svh items-center justify-center bg-background p-4"
      data-testid="onboarding-wizard"
    >
      <Card className="w-full max-w-2xl">
        <CardContent className="flex flex-col gap-6 p-8">
          {step === 0 && <WelcomeStep />}
          {step === 1 && <UnitsStep />}
          {step === 2 && <AppearanceStep />}
          {step === EXERCISES_STEP && (
            <ExercisesStep
              equipment={equipment}
              selected={selected}
              onToggleEquipment={toggleEquipment}
              onToggleName={toggleName}
            />
          )}
          {step === FINISH_STEP && (
            <FinishStep
              summary={seed.data ?? null}
              onRetry={retrySeed}
              onLogWorkout={() => finish('/workouts')}
              onExplore={() => finish('/')}
            />
          )}

          <div
            className="flex items-center justify-center gap-1.5"
            aria-label={`Step ${step + 1} of ${STEP_COUNT}`}
          >
            {Array.from({ length: STEP_COUNT }, (_, index) => (
              <span
                key={index}
                className={cn(
                  'size-2 rounded-full transition-colors',
                  index === step ? 'bg-primary' : 'bg-muted',
                )}
              />
            ))}
            <span className="ml-2 text-xs text-muted-foreground">
              Step {step + 1} of {STEP_COUNT}
            </span>
          </div>

          {step !== FINISH_STEP && (
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                className={cn(step === 0 && 'invisible')}
                disabled={seed.isPending}
                onClick={() => goTo((current) => current - 1)}
              >
                Back
              </Button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                  disabled={seed.isPending}
                  onClick={skip}
                >
                  Skip for now
                </button>
                <Button disabled={seed.isPending} onClick={() => void next()}>
                  {nextLabel()}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
