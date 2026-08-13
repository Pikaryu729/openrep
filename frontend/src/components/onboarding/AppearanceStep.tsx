import { useTheme, type ThemeMode } from '@/lib/theme'
import { THEME_PRESET_DEFINITIONS, THEME_PRESETS } from '@/lib/themePresets'
import { cn } from '@/lib/utils'

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export function AppearanceStep() {
  const { theme, update } = useTheme()

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <h2 className="text-xl font-semibold tracking-tight">Make it yours</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Pick a mode and a theme — changes apply as you click. The full theme editor in Settings
        can customize every color later.
      </p>
      <div
        className="inline-flex overflow-hidden rounded-md border bg-card"
        role="group"
        aria-label="Color mode"
      >
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            data-testid={`onboarding-mode-${mode.value}`}
            aria-pressed={theme.mode === mode.value}
            onClick={() => update({ mode: mode.value })}
            className={cn(
              'px-5 py-2.5 text-sm font-medium transition-colors not-first:border-l',
              theme.mode === mode.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div className="flex max-w-lg flex-wrap justify-center gap-2">
        {THEME_PRESETS.map((preset) => {
          const selected = theme.preset === preset
          return (
            <button
              key={preset}
              type="button"
              data-testid={`onboarding-preset-${preset}`}
              aria-pressed={selected}
              onClick={() => update({ preset })}
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
    </div>
  )
}
