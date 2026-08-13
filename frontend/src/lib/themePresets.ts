/**
 * Built-in theme presets.
 *
 * A preset is a *sparse* patch over the base tokens in themeTokens.ts, not a
 * full palette: the five original presets (graphite, ocean, forest, sunset,
 * orchid) still touch only the brand accent, so their look is unchanged from
 * when they lived as `data-theme` blocks in index.css. Later presets patch more.
 *
 * Sparseness matters beyond brevity — a token a preset leaves alone keeps
 * following its derivation (see DERIVED_FROM), so an accent-only preset still
 * moves the sidebar highlight and focus rings with it.
 */

import type { ColorMap, GlobalTokens, ShadowTokens } from './themeTokens'
import { FONT_STACKS } from './themeTokens'

export interface ThemePresetDefinition {
  label: string
  /** Swatch color for the settings picker. */
  swatch: string
  light?: Partial<ColorMap>
  dark?: Partial<ColorMap>
  shadowLight?: Partial<ShadowTokens>
  shadowDark?: Partial<ShadowTokens>
  global?: Partial<GlobalTokens>
}

/**
 * Literal table, used only to derive ThemePreset. Consumers use the widened
 * THEME_PRESET_DEFINITIONS below — see the same note in themeTokens.ts for why
 * `as const satisfies` alone does not work here.
 */
const RAW_PRESETS = {
  // --- the original five, accent-only --------------------------------------
  graphite: {
    label: 'Graphite',
    swatch: '#3f3f46',
    light: { primary: '#3f3f46', primaryForeground: '#ffffff' },
    // zinc-300, not zinc-400: the button color for the whole app in dark mode,
    // and 400 reads as disabled next to real disabled buttons.
    dark: { primary: '#d4d4d8', primaryForeground: '#18181b' },
  },
  ocean: {
    label: 'Ocean',
    swatch: '#0369a1',
    light: { primary: '#0369a1', primaryForeground: '#ffffff' },
    dark: { primary: '#38bdf8', primaryForeground: '#082032' },
  },
  forest: {
    label: 'Forest',
    swatch: '#15803d',
    light: { primary: '#15803d', primaryForeground: '#ffffff' },
    dark: { primary: '#4ade80', primaryForeground: '#052012' },
  },
  sunset: {
    label: 'Sunset',
    swatch: '#c2410c',
    light: { primary: '#c2410c', primaryForeground: '#ffffff' },
    dark: { primary: '#fb923c', primaryForeground: '#2a1204' },
  },
  orchid: {
    label: 'Orchid',
    swatch: '#7c3aed',
    light: { primary: '#7c3aed', primaryForeground: '#ffffff' },
    dark: { primary: '#a78bfa', primaryForeground: '#1e1235' },
  },

  // --- full-surface presets ------------------------------------------------
  midnight: {
    label: 'Midnight',
    swatch: '#6366f1',
    light: {
      primary: '#4f46e5',
      primaryForeground: '#ffffff',
      background: '#fafaff',
      card: '#ffffff',
      muted: '#eeeef7',
      secondary: '#eeeef7',
      border: '#dededf',
      input: '#dededf',
      sidebar: '#f4f4fb',
      sidebarBorder: '#dededf',
    },
    dark: {
      primary: '#818cf8',
      primaryForeground: '#0d0d2b',
      background: '#0b0b14',
      card: '#14141f',
      popover: '#14141f',
      muted: '#1e1e2e',
      secondary: '#1e1e2e',
      border: '#2a2a3d',
      input: '#2a2a3d',
      sidebar: '#0f0f19',
      sidebarAccent: '#1e1e2e',
      sidebarBorder: '#2a2a3d',
    },
    global: { radius: '0.75rem' },
  },

  sandstone: {
    label: 'Sandstone',
    swatch: '#b45309',
    light: {
      primary: '#b45309',
      primaryForeground: '#fffbf5',
      background: '#faf6f0',
      foreground: '#292018',
      card: '#fffdfa',
      cardForeground: '#292018',
      popover: '#fffdfa',
      muted: '#f0e9df',
      mutedForeground: '#7a6a58',
      secondary: '#f0e9df',
      border: '#e3d9cb',
      input: '#e3d9cb',
      sidebar: '#f5efe6',
      sidebarAccent: '#ebe2d5',
      sidebarBorder: '#e3d9cb',
    },
    dark: {
      primary: '#f59e0b',
      primaryForeground: '#291a04',
      background: '#17130f',
      foreground: '#ede4d8',
      card: '#201a15',
      cardForeground: '#ede4d8',
      popover: '#201a15',
      muted: '#2b231b',
      mutedForeground: '#a89680',
      secondary: '#2b231b',
      border: '#3a2f24',
      input: '#3a2f24',
      sidebar: '#1b1611',
      sidebarAccent: '#2b231b',
      sidebarBorder: '#3a2f24',
    },
    global: { radius: '0.5rem', fontSerif: FONT_STACKS[4].value },
  },

  bubblegum: {
    label: 'Bubblegum',
    swatch: '#db2777',
    light: {
      primary: '#db2777',
      primaryForeground: '#ffffff',
      background: '#fff5fa',
      card: '#ffffff',
      muted: '#fce7f1',
      secondary: '#fce7f1',
      border: '#f6d3e4',
      input: '#f6d3e4',
      sidebar: '#fdeaf3',
      sidebarAccent: '#fbd9e9',
      sidebarBorder: '#f6d3e4',
    },
    dark: {
      primary: '#f472b6',
      primaryForeground: '#3b0722',
      background: '#170d13',
      card: '#21131b',
      popover: '#21131b',
      muted: '#2e1a25',
      secondary: '#2e1a25',
      border: '#3e2331',
      input: '#3e2331',
      sidebar: '#1c1017',
      sidebarAccent: '#2e1a25',
      sidebarBorder: '#3e2331',
    },
    global: { radius: '1rem' },
  },

  nord: {
    label: 'Nord',
    swatch: '#5e81ac',
    light: {
      // Nord's own #5e81ac gives white only 4.07:1; darkened to clear 4.5:1.
      primary: '#55749b',
      primaryForeground: '#ffffff',
      background: '#eceff4',
      foreground: '#2e3440',
      card: '#f7f9fc',
      cardForeground: '#2e3440',
      popover: '#f7f9fc',
      muted: '#e0e5ee',
      mutedForeground: '#5b6478',
      secondary: '#e0e5ee',
      border: '#d3dae6',
      input: '#d3dae6',
      // Nord's aurora red is 4.09:1 on white; darkened for the same reason.
      destructive: '#b4535c',
      sidebar: '#e6ebf2',
      sidebarAccent: '#dae1eb',
      sidebarBorder: '#d3dae6',
    },
    dark: {
      primary: '#88c0d0',
      primaryForeground: '#1d2733',
      background: '#2e3440',
      foreground: '#e5e9f0',
      card: '#363d4b',
      cardForeground: '#e5e9f0',
      popover: '#363d4b',
      muted: '#3b4252',
      mutedForeground: '#a3aec2',
      secondary: '#3b4252',
      border: '#454d5f',
      input: '#454d5f',
      // Brightened: against the dark destructive foreground the stock red lands
      // on 4.50:1 exactly, which is too close to the line to ship.
      destructive: '#cf6f78',
      sidebar: '#292f3a',
      sidebarAccent: '#3b4252',
      sidebarBorder: '#454d5f',
    },
  },

  mono: {
    label: 'Mono',
    swatch: '#171717',
    light: {
      primary: '#171717',
      primaryForeground: '#fafafa',
      background: '#ffffff',
      foreground: '#0a0a0a',
      card: '#ffffff',
      muted: '#f5f5f5',
      mutedForeground: '#737373',
      secondary: '#f5f5f5',
      border: '#e5e5e5',
      input: '#e5e5e5',
      sidebar: '#fafafa',
      sidebarAccent: '#f0f0f0',
      sidebarBorder: '#e5e5e5',
    },
    dark: {
      primary: '#fafafa',
      primaryForeground: '#171717',
      background: '#0a0a0a',
      foreground: '#fafafa',
      card: '#171717',
      popover: '#171717',
      muted: '#262626',
      mutedForeground: '#a3a3a3',
      secondary: '#262626',
      border: '#2e2e2e',
      input: '#2e2e2e',
      sidebar: '#111111',
      sidebarAccent: '#262626',
      sidebarBorder: '#2e2e2e',
    },
    global: { radius: '0.25rem', fontSans: FONT_STACKS[5].value },
    shadowLight: { opacity: '0.06' },
  },
} as const satisfies Record<string, ThemePresetDefinition>

export type ThemePreset = keyof typeof RAW_PRESETS

export const THEME_PRESET_DEFINITIONS: Record<ThemePreset, ThemePresetDefinition> = RAW_PRESETS

export const THEME_PRESETS = Object.keys(RAW_PRESETS) as ThemePreset[]

export const DEFAULT_PRESET: ThemePreset = 'graphite'

export function isThemePreset(value: unknown): value is ThemePreset {
  return typeof value === 'string' && value in RAW_PRESETS
}

/** Representative accent per preset, for the swatch dots in settings. */
export const PRESET_ACCENTS: Record<ThemePreset, string> = Object.fromEntries(
  Object.entries(THEME_PRESET_DEFINITIONS).map(([key, preset]) => [key, preset.swatch]),
) as Record<ThemePreset, string>
