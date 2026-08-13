import type { SegmentedOption } from '@/components/SegmentedControl'
import type { ThemeMode } from '@/lib/theme'
import type { UnitSystem } from '@/lib/units'

// Shared between Settings and the onboarding wizard so the labels never
// drift. Lives outside SegmentedControl.tsx so that file only exports the
// component (fast-refresh lint rule).
export const MODES: SegmentedOption<ThemeMode>[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export const UNIT_OPTIONS: SegmentedOption<UnitSystem>[] = [
  { value: 'metric', label: 'Metric (kg)' },
  { value: 'imperial', label: 'Imperial (lb)' },
]
