import { THEME_PRESET_DEFINITIONS, THEME_PRESETS, type ThemePreset } from '@/lib/themePresets'
import { cn } from '@/lib/utils'

interface PresetPickerProps {
  value: ThemePreset
  onChange: (preset: ThemePreset) => void
  /** Each chip renders `data-testid={testidPrefix + preset}`. */
  testidPrefix: string
  className?: string
}

/** Theme preset chips with swatches, shared by Settings and onboarding. */
export function PresetPicker({ value, onChange, testidPrefix, className }: PresetPickerProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {THEME_PRESETS.map((preset) => {
        const selected = value === preset
        return (
          <button
            key={preset}
            type="button"
            data-testid={`${testidPrefix}${preset}`}
            aria-pressed={selected}
            onClick={() => onChange(preset)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm transition-colors',
              selected ? 'border-primary ring-[3px] ring-primary/25' : 'hover:bg-muted',
            )}
          >
            <span
              className="size-3.5 rounded-full"
              style={{ background: THEME_PRESET_DEFINITIONS[preset].swatch }}
            />
            {THEME_PRESET_DEFINITIONS[preset].label}
          </button>
        )
      })}
    </div>
  )
}
