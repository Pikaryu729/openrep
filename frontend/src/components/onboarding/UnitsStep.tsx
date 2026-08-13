import { saveUnits, useUnits, type UnitSystem } from '@/lib/units'
import { cn } from '@/lib/utils'

const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: 'metric', label: 'Metric (kg)' },
  { value: 'imperial', label: 'Imperial (lb)' },
]

export function UnitsStep() {
  const units = useUnits()

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <h2 className="text-xl font-semibold tracking-tight">How do you load a bar?</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Weights are always stored in kilograms; this only changes how you enter and read them.
      </p>
      <div
        className="inline-flex overflow-hidden rounded-md border bg-card"
        role="group"
        aria-label="Weight units"
      >
        {UNIT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            data-testid={`onboarding-unit-${option.value}`}
            aria-pressed={units === option.value}
            onClick={() => saveUnits(option.value)}
            className={cn(
              'px-5 py-2.5 text-sm font-medium transition-colors not-first:border-l',
              units === option.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
