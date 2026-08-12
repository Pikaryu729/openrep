import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_THEME,
  EMPTY_OVERRIDES,
  THEME_SCHEMA_VERSION,
  THEME_STORAGE_KEY,
  applyTheme,
  buildCssVars,
  contrastColorFor,
  loadTheme,
  resolveColors,
  resolveGlobal,
  saveTheme,
  type ThemeOverrides,
} from './theme'
import { BASE_LIGHT } from './themeTokens'

const overridesWith = (light: Record<string, string>): ThemeOverrides => ({
  ...EMPTY_OVERRIDES,
  colors: { light, dark: {} },
})

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
  document.documentElement.removeAttribute('data-mode')
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('style')
})

describe('loadTheme / saveTheme', () => {
  it('round-trips through localStorage', () => {
    const settings = {
      mode: 'dark' as const,
      preset: 'ocean' as const,
      overrides: overridesWith({ primary: '#ff0000' }),
    }
    saveTheme(settings)
    expect(loadTheme()).toEqual(settings)
  })

  it('falls back to defaults when storage is empty', () => {
    expect(loadTheme()).toEqual(DEFAULT_THEME)
  })

  it('falls back to defaults on unparseable storage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'not json')
    expect(loadTheme()).toEqual(DEFAULT_THEME)
  })

  it('falls back per field rather than discarding the whole theme', () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ v: THEME_SCHEMA_VERSION, mode: 'neon', preset: 'ocean', overrides: {} }),
    )
    const loaded = loadTheme()
    expect(loaded.mode).toBe('system')
    expect(loaded.preset).toBe('ocean')
  })

  it('drops unknown color keys instead of trusting stored input', () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({
        v: THEME_SCHEMA_VERSION,
        mode: 'light',
        preset: 'ocean',
        overrides: { colors: { light: { primary: '#123456', bogus: '#ffffff' } } },
      }),
    )
    expect(loadTheme().overrides.colors.light).toEqual({ primary: '#123456' })
  })

  it('persists precomputed vars for both modes so the boot script needs no math', () => {
    saveTheme({ mode: 'light', preset: 'ocean', overrides: EMPTY_OVERRIDES })
    const stored = JSON.parse(localStorage.getItem(THEME_STORAGE_KEY)!)
    expect(stored.v).toBe(THEME_SCHEMA_VERSION)
    expect(stored.vars.light['--accent']).toBe('#0369a1')
    expect(stored.vars.dark['--accent']).toBe('#38bdf8')
  })
})

describe('v1 migration', () => {
  it('folds a v1 custom accent into both modes', () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ mode: 'dark', preset: 'forest', accent: '#123456', accentContrast: '#fff' }),
    )
    const loaded = loadTheme()
    expect(loaded.preset).toBe('forest')
    expect(loaded.overrides.colors.light.primary).toBe('#123456')
    expect(loaded.overrides.colors.dark.primary).toBe('#123456')
  })

  it('leaves a v1 theme without a custom accent on its preset', () => {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ mode: 'light', preset: 'orchid', accent: null }),
    )
    expect(loadTheme().overrides).toEqual(EMPTY_OVERRIDES)
  })
})

describe('resolveColors', () => {
  it('layers base, then preset, then user override', () => {
    expect(resolveColors('light', 'graphite', EMPTY_OVERRIDES).primary).toBe(BASE_LIGHT.primary)
    expect(resolveColors('light', 'ocean', EMPTY_OVERRIDES).primary).toBe('#0369a1')
    expect(resolveColors('light', 'ocean', overridesWith({ primary: '#abcdef' })).primary).toBe(
      '#abcdef',
    )
  })

  // The point of sparse presets: an accent-only preset still moves everything
  // that follows the accent.
  it('carries derived tokens along with the preset accent', () => {
    const colors = resolveColors('light', 'ocean', EMPTY_OVERRIDES)
    expect(colors.ring).toBe('#0369a1')
    expect(colors.sidebarPrimary).toBe('#0369a1')
    expect(colors.sidebarRing).toBe('#0369a1')
  })

  it('lets an explicit override win over a derivation', () => {
    const colors = resolveColors('light', 'ocean', overridesWith({ ring: '#00ff00' }))
    expect(colors.ring).toBe('#00ff00')
    expect(colors.sidebarPrimary).toBe('#0369a1')
  })

  it('keeps the hover wash on the neutral scale, not the brand accent', () => {
    const colors = resolveColors('light', 'ocean', EMPTY_OVERRIDES)
    expect(colors.uiAccent).toBe(colors.muted)
    expect(colors.uiAccent).not.toBe(colors.primary)
  })
})

describe('buildCssVars', () => {
  it('writes the brand accent to --accent, not --primary', () => {
    const vars = buildCssVars('light', 'ocean', EMPTY_OVERRIDES)
    expect(vars['--accent']).toBe('#0369a1')
    expect(vars['--primary']).toBeUndefined()
  })

  it('writes the hover wash to --ui-accent', () => {
    expect(buildCssVars('light', 'graphite', EMPTY_OVERRIDES)['--ui-accent']).toBe('#efeff1')
  })

  it('composes a shadow scale from the shadow tokens', () => {
    const vars = buildCssVars('light', 'graphite', EMPTY_OVERRIDES)
    expect(vars['--sh-sm']).toMatch(/^0px 1px 3px 0px rgba\(0, 0, 0, 0\.1\)$/)
    expect(vars['--sh-xl']).toContain('24px')
  })

  it('carries preset globals such as radius', () => {
    expect(resolveGlobal('mono', EMPTY_OVERRIDES).radius).toBe('0.25rem')
    expect(buildCssVars('light', 'bubblegum', EMPTY_OVERRIDES)['--radius']).toBe('1rem')
  })
})

describe('applyTheme', () => {
  it('sets data attributes for explicit modes', () => {
    applyTheme({ mode: 'dark', preset: 'forest', overrides: EMPTY_OVERRIDES })
    expect(document.documentElement.dataset.mode).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('forest')
  })

  it('resolves system mode via matchMedia', () => {
    applyTheme({ mode: 'system', preset: 'graphite', overrides: EMPTY_OVERRIDES })
    expect(document.documentElement.dataset.mode).toBe('light')
  })

  it('writes resolved tokens as inline custom properties', () => {
    applyTheme({
      mode: 'light',
      preset: 'ocean',
      overrides: overridesWith({ background: '#010203' }),
    })
    const style = document.documentElement.style
    expect(style.getPropertyValue('--accent')).toBe('#0369a1')
    expect(style.getPropertyValue('--background')).toBe('#010203')
  })
})

describe('contrastColorFor', () => {
  it('picks dark text on light accents and white on dark accents', () => {
    expect(contrastColorFor('#ffff00')).toBe('#18181b')
    expect(contrastColorFor('#1e3a8a')).toBe('#ffffff')
  })
})
