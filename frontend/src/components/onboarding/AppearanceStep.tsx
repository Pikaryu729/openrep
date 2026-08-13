import { PresetPicker } from '@/components/PresetPicker'
import { SegmentedControl } from '@/components/SegmentedControl'
import { MODES } from '@/components/segmentedOptions'
import { useTheme } from '@/lib/theme'

export function AppearanceStep() {
  const { theme, update } = useTheme()

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <h2 className="text-xl font-semibold tracking-tight">Make it yours</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Pick a mode and a theme — changes apply as you click. The full theme editor in Settings
        can customize every color later.
      </p>
      <SegmentedControl
        options={MODES}
        value={theme.mode}
        onChange={(mode) => update({ mode })}
        aria-label="Color mode"
        testidPrefix="onboarding-mode-"
      />
      <PresetPicker
        value={theme.preset}
        onChange={(preset) => update({ preset })}
        testidPrefix="onboarding-preset-"
        className="max-w-lg justify-center"
      />
    </div>
  )
}
