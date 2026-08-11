import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark' | 'system'

export const THEME_PRESETS = ['graphite', 'ocean', 'forest', 'sunset', 'orchid'] as const
export type ThemePreset = (typeof THEME_PRESETS)[number]

/** Representative accent per preset, for swatch dots in the settings UI. */
export const PRESET_ACCENTS: Record<ThemePreset, string> = {
  graphite: '#3f3f46',
  ocean: '#0369a1',
  forest: '#15803d',
  sunset: '#c2410c',
  orchid: '#7c3aed',
}

export interface ThemeSettings {
  mode: ThemeMode
  preset: ThemePreset
  /** Custom accent overriding the preset, or null to use the preset's. */
  accent: string | null
  /** Precomputed so the index.html boot script needs zero math. */
  accentContrast: string | null
}

export const THEME_STORAGE_KEY = 'openrep.theme'

export const DEFAULT_THEME: ThemeSettings = {
  mode: 'system',
  preset: 'graphite',
  accent: null,
  accentContrast: null,
}

export function contrastColorFor(hex: string): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16) / 255
  const g = parseInt(value.slice(2, 4), 16) / 255
  const b = parseInt(value.slice(4, 6), 16) / 255
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  return luminance > 0.4 ? '#18181b' : '#ffffff'
}

export function loadTheme(): ThemeSettings {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (!raw) return DEFAULT_THEME
    const parsed = JSON.parse(raw) as Partial<ThemeSettings>
    return {
      mode: parsed.mode === 'light' || parsed.mode === 'dark' ? parsed.mode : 'system',
      preset: THEME_PRESETS.includes(parsed.preset as ThemePreset)
        ? (parsed.preset as ThemePreset)
        : 'graphite',
      accent: typeof parsed.accent === 'string' ? parsed.accent : null,
      accentContrast: typeof parsed.accentContrast === 'string' ? parsed.accentContrast : null,
    }
  } catch {
    return DEFAULT_THEME
  }
}

export function saveTheme(settings: ThemeSettings): void {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(settings))
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyTheme(settings: ThemeSettings): void {
  const root = document.documentElement
  root.dataset.mode =
    settings.mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : settings.mode
  root.dataset.theme = settings.preset
  if (settings.accent) {
    root.style.setProperty('--accent', settings.accent)
    root.style.setProperty('--accent-contrast', settings.accentContrast ?? '#ffffff')
  } else {
    root.style.removeProperty('--accent')
    root.style.removeProperty('--accent-contrast')
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeSettings>(loadTheme)

  const update = (changes: Partial<ThemeSettings>) => {
    setTheme((current) => {
      const next = { ...current, ...changes }
      saveTheme(next)
      applyTheme(next)
      return next
    })
  }

  useEffect(() => {
    if (theme.mode !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(theme)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  return { theme, update }
}
