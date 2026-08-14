import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  starterByCategory,
  type Equipment,
} from '@/lib/starterExercises'
import { cn } from '@/lib/utils'

interface ExercisesStepProps {
  equipment: Set<Equipment>
  selected: Set<string>
  onToggleEquipment: (kind: Equipment) => void
  onToggleName: (name: string) => void
}

/**
 * The questionnaire heart of the wizard: equipment answers preselect a
 * curated starter library, and individual checkboxes fine-tune from there.
 */
export function ExercisesStep({
  equipment,
  selected,
  onToggleEquipment,
  onToggleName,
}: ExercisesStepProps) {
  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="text-center">
        <h2 className="text-xl font-semibold tracking-tight">What do you train with?</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          We&apos;ll stock your exercise library to match. Uncheck anything you don&apos;t want —
          it&apos;s your database, and every exercise can be renamed or deleted later.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Equipment">
        {EQUIPMENT.map((kind) => {
          const enabled = equipment.has(kind)
          return (
            <button
              key={kind}
              type="button"
              data-testid={`onboarding-equipment-${kind}`}
              aria-pressed={enabled}
              onClick={() => onToggleEquipment(kind)}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                enabled
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted',
              )}
            >
              {EQUIPMENT_LABELS[kind]}
            </button>
          )
        })}
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {[...starterByCategory()].map(([category, exercises]) => {
            const shown = exercises.filter((exercise) => equipment.has(exercise.equipment))
            if (shown.length === 0) return null
            return (
              <fieldset key={category}>
                <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {category}
                </legend>
                <div className="flex flex-col gap-1">
                  {shown.map((exercise) => (
                    <label key={exercise.name} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={selected.has(exercise.name)}
                        onChange={() => onToggleName(exercise.name)}
                      />
                      {exercise.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )
          })}
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        {selected.size === 0
          ? 'Nothing selected — you can start from a blank library.'
          : `${selected.size} exercises selected`}
      </p>
    </div>
  )
}
