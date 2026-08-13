import { SegmentedControl } from '@/components/SegmentedControl'
import { UNIT_OPTIONS } from '@/components/segmentedOptions'
import { saveUnits, useUnits } from '@/lib/units'

export function UnitsStep() {
  const units = useUnits()

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <h2 className="text-xl font-semibold tracking-tight">How do you load a bar?</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Weights are always stored in kilograms; this only changes how you enter and read them.
      </p>
      <SegmentedControl
        options={UNIT_OPTIONS}
        value={units}
        onChange={saveUnits}
        aria-label="Weight units"
        testidPrefix="onboarding-unit-"
      />
    </div>
  )
}
