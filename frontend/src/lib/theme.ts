import { useCallback, useEffect, useState } from 'react'
import { contrastColorFor } from './color'
import {
  DEFAULT_PRESET,
  THEME_PRESET_DEFINITIONS,
  THEME_PRESETS,
  PRESET_ACCENTS,
  isThemePreset,
  type ThemePreset,
} from './themePresets'
import {
  BASE_DARK,
  BASE_GLOBAL,
  BASE_LIGHT,
  BASE_SHADOW_DARK,
  BASE_SHADOW_LIGHT,
  COLOR_TOKENS,
  COLOR_TOKEN_KEYS,
  DERIVED_FROM,
  type ColorMap,
  type ColorTokenKey,
  type GlobalTokens,
  type ShadowTokens,
} from './themeTokens'

export type { ThemePreset }
export { THEME_PRESETS, PRESET_ACCENTS, contrastColorFor }

export type ThemeMode = 'light' | 'dark' | 'system'
/** The two modes a theme actually renders in; 'system' resolves to one of these. */
export type ResolvedMode = 'light' | 'dark'

export interface ThemeOverrides {
  colors: Record<ResolvedMode, Partial<ColorMap>>
  shadow: Record<ResolvedMode, Partial<ShadowTokens>>
  global: Partial<GlobalTokens>
}

export interface ThemeSettings {
  mode: ThemeMode
  preset: ThemePreset
  overrides: ThemeOverrides
}

export const THEME_STORAGE_KEY = 'openrep.theme'
/** Bumped when the persisted shape changes in a way loadTheme must notice. */
export const THEME_SCHEMA_VERSION = 2

export const EMPTY_OVERRIDES: ThemeOverrides = {
  colors: { light: {}, dark: {} },
  shadow: { light: {}, dark: {} },
  global: {},
}

export const DEFAULT_THEME: ThemeSettings = {
  mode: 'system',
  preset: DEFAULT_PRESET,
  overrides: EMPTY_OVERRIDES,
}

// --- resolution --------------------------------------------------------------

/**
 * Collapses base → preset → user overrides into the final palette for one mode.
 *
 * Derivations (ring follows primary, and friends) are applied only where
 * *neither* the preset nor the user named the token, which is what lets an
 * accent-only preset still move the focus rings and sidebar highlight.
 */
export function resolveColors(
  mode: ResolvedMode,
  preset: ThemePreset,
  overrides: ThemeOverrides,
): ColorMap {
  const base = mode === 'dark' ? BASE_DARK : BASE_LIGHT
  const presetPatch = (THEME_PRESET_DEFINITIONS[preset][mode] ?? {}) as Partial<ColorMap>
  const userPatch = overrides.colors[mode] ?? {}
  const merged: ColorMap = { ...base, ...presetPatch, ...userPatch }

  for (const [key, source] of Object.entries(DERIVED_FROM) as [ColorTokenKey, ColorTokenKey][]) {
    if (key in presetPatch || key in userPatch) continue
    merged[key] = merged[source]
  }
  return merged
}

export function resolveShadow(
  mode: ResolvedMode,
  preset: ThemePreset,
  overrides: ThemeOverrides,
): ShadowTokens {
  const base = mode === 'dark' ? BASE_SHADOW_DARK : BASE_SHADOW_LIGHT
  const presetPatch =
    (mode === 'dark'
      ? THEME_PRESET_DEFINITIONS[preset].shadowDark
      : THEME_PRESET_DEFINITIONS[preset].shadowLight) ?? {}
  return { ...base, ...presetPatch, ...(overrides.shadow[mode] ?? {}) }
}

export function resolveGlobal(preset: ThemePreset, overrides: ThemeOverrides): GlobalTokens {
  return { ...BASE_GLOBAL, ...(THEME_PRESET_DEFINITIONS[preset].global ?? {}), ...overrides.global }
}

/** Shadow scale steps, as [name, blur multiplier, offset multiplier, opacity multiplier]. */
const SHADOW_STEPS: [string, number, number, number][] = [
  ['xs', 0.5, 0.5, 0.7],
  ['sm', 1, 1, 1],
  ['md', 2, 1.5, 1.1],
  ['lg', 4, 2.5, 1.2],
  ['xl', 8, 4, 1.3],
]

const px = (value: string, factor: number) => {
  const n = Number.parseFloat(value)
  return Number.isNaN(n) ? value : `${Math.round(n * factor * 100) / 100}px`
}

function shadowVars(shadow: ShadowTokens): Record<string, string> {
  const rgb = shadow.color.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(rgb.slice(i, i + 2), 16) || 0)
  const baseOpacity = Number.parseFloat(shadow.opacity) || 0
  const vars: Record<string, string> = {}
  for (const [name, blurFactor, offsetFactor, opacityFactor] of SHADOW_STEPS) {
    const alpha = Math.min(1, Math.round(baseOpacity * opacityFactor * 1000) / 1000)
    vars[`--sh-${name}`] =
      `${px(shadow.offsetX, 1)} ${px(shadow.offsetY, offsetFactor)} ${px(shadow.blur, blurFactor)} ${px(shadow.spread, 1)} rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return vars
}

/**
 * The flat CSS-variable map for one mode — exactly what gets written to the
 * document, and what gets persisted so the boot script can replay it with no
 * math before first paint.
 */
export function buildCssVars(
  mode: ResolvedMode,
  preset: ThemePreset,
  overrides: ThemeOverrides,
): Record<string, string> {
  const colors = resolveColors(mode, preset, overrides)
  const global = resolveGlobal(preset, overrides)
  const vars: Record<string, string> = {}

  for (const token of COLOR_TOKENS) vars[token.cssVar] = colors[token.key]
  Object.assign(vars, shadowVars(resolveShadow(mode, preset, overrides)))

  vars['--radius'] = global.radius
  vars['--app-font-sans'] = global.fontSans
  vars['--app-font-serif'] = global.fontSerif
  vars['--app-font-mono'] = global.fontMono
  vars['--app-letter-spacing'] = global.letterSpacing
  vars['--app-spacing'] = global.spacing
  return vars
}

// --- persistence -------------------------------------------------------------

interface PersistedTheme {
  v: number
  mode: ThemeMode
  preset: ThemePreset
  overrides: ThemeOverrides
  /** Precomputed so index.html's boot script needs zero math. */
  vars: Record<ResolvedMode, Record<string, string>>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Keeps only known color keys with string values — an unknown key is dropped. */
function sanitizeColorPatch(value: unknown): Partial<ColorMap> {
  if (!isRecord(value)) return {}
  const out: Partial<ColorMap> = {}
  for (const key of COLOR_TOKEN_KEYS) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate) out[key] = candidate
  }
  return out
}

function sanitizeShadowPatch(value: unknown): Partial<ShadowTokens> {
  if (!isRecord(value)) return {}
  const out: Partial<ShadowTokens> = {}
  for (const key of ['color', 'opacity', 'blur', 'spread', 'offsetX', 'offsetY'] as const) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate) out[key] = candidate
  }
  return out
}

function sanitizeGlobalPatch(value: unknown): Partial<GlobalTokens> {
  if (!isRecord(value)) return {}
  const out: Partial<GlobalTokens> = {}
  for (const key of Object.keys(BASE_GLOBAL) as (keyof GlobalTokens)[]) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate) out[key] = candidate
  }
  return out
}

export function sanitizeOverrides(value: unknown): ThemeOverrides {
  if (!isRecord(value)) return EMPTY_OVERRIDES
  const colors = isRecord(value.colors) ? value.colors : {}
  const shadow = isRecord(value.shadow) ? value.shadow : {}
  return {
    colors: {
      light: sanitizeColorPatch(colors.light),
      dark: sanitizeColorPatch(colors.dark),
    },
    shadow: {
      light: sanitizeShadowPatch(shadow.light),
      dark: sanitizeShadowPatch(shadow.dark),
    },
    global: sanitizeGlobalPatch(value.global),
  }
}

/**
 * v1 stored a single global accent pair (`accent`/`accentContrast`) rather than
 * per-mode token overrides. Fold it into both modes so a theme picked before
 * the editor existed still looks the same afterwards.
 */
function migrateV1(parsed: Record<string, unknown>): ThemeOverrides {
  const accent = typeof parsed.accent === 'string' ? parsed.accent : null
  if (!accent) return EMPTY_OVERRIDES
  const contrast =
    typeof parsed.accentContrast === 'string' ? parsed.accentContrast : contrastColorFor(accent)
  const patch = { primary: accent, primaryForeground: contrast }
  return { colors: { light: { ...patch }, dark: { ...patch } }, shadow: { light: {}, dark: {} }, global: {} }
}

export function loadTheme(): ThemeSettings {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY)
    if (!raw) return DEFAULT_THEME
    const parsed = JSON.parse(raw) as unknown
    if (!isRecord(parsed)) return DEFAULT_THEME

    const mode: ThemeMode =
      parsed.mode === 'light' || parsed.mode === 'dark' ? parsed.mode : 'system'
    const preset = isThemePreset(parsed.preset) ? parsed.preset : DEFAULT_PRESET
    const overrides =
      parsed.v === THEME_SCHEMA_VERSION ? sanitizeOverrides(parsed.overrides) : migrateV1(parsed)

    return { mode, preset, overrides }
  } catch {
    return DEFAULT_THEME
  }
}

export function saveTheme(settings: ThemeSettings): void {
  const payload: PersistedTheme = {
    v: THEME_SCHEMA_VERSION,
    ...settings,
    vars: {
      light: buildCssVars('light', settings.preset, settings.overrides),
      dark: buildCssVars('dark', settings.preset, settings.overrides),
    },
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // A full or unavailable localStorage must not take the app down; the theme
    // is still applied to the live document, it just will not survive a reload.
  }
}

// --- application -------------------------------------------------------------

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveMode(mode: ThemeMode): ResolvedMode {
  return mode === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : mode
}

/** Tracks what we wrote so switching themes can clear vars the new one omits. */
let appliedVars: string[] = []

export function applyTheme(settings: ThemeSettings): void {
  const root = document.documentElement
  const mode = resolveMode(settings.mode)
  root.dataset.mode = mode
  root.dataset.theme = settings.preset

  const vars = buildCssVars(mode, settings.preset, settings.overrides)
  for (const name of appliedVars) {
    if (!(name in vars)) root.style.removeProperty(name)
  }
  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)
  appliedVars = Object.keys(vars)
}

// --- hook --------------------------------------------------------------------

export function useTheme() {
  const [theme, setTheme] = useState<ThemeSettings>(loadTheme)

  const update = useCallback((changes: Partial<ThemeSettings>) => {
    setTheme((current) => {
      const next = { ...current, ...changes }
      saveTheme(next)
      applyTheme(next)
      return next
    })
  }, [])

  /** Sets or clears one color token for one mode. */
  const setColor = useCallback(
    (mode: ResolvedMode, key: ColorTokenKey, value: string | null) => {
      setTheme((current) => {
        const patch = { ...current.overrides.colors[mode] }
        if (value === null) delete patch[key]
        else patch[key] = value
        const next: ThemeSettings = {
          ...current,
          overrides: {
            ...current.overrides,
            colors: { ...current.overrides.colors, [mode]: patch },
          },
        }
        saveTheme(next)
        applyTheme(next)
        return next
      })
    },
    [],
  )

  const setShadow = useCallback((mode: ResolvedMode, key: keyof ShadowTokens, value: string) => {
    setTheme((current) => {
      const next: ThemeSettings = {
        ...current,
        overrides: {
          ...current.overrides,
          shadow: {
            ...current.overrides.shadow,
            [mode]: { ...current.overrides.shadow[mode], [key]: value },
          },
        },
      }
      saveTheme(next)
      applyTheme(next)
      return next
    })
  }, [])

  const setGlobal = useCallback((key: keyof GlobalTokens, value: string) => {
    setTheme((current) => {
      const next: ThemeSettings = {
        ...current,
        overrides: { ...current.overrides, global: { ...current.overrides.global, [key]: value } },
      }
      saveTheme(next)
      applyTheme(next)
      return next
    })
  }, [])

  /** Drops every customization, back to the bare preset. */
  const resetOverrides = useCallback(() => {
    setTheme((current) => {
      const next: ThemeSettings = { ...current, overrides: EMPTY_OVERRIDES }
      saveTheme(next)
      applyTheme(next)
      return next
    })
  }, [])

  useEffect(() => {
    if (theme.mode !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme(theme)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  return { theme, update, setColor, setShadow, setGlobal, resetOverrides }
}
