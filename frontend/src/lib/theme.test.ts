import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  applyTheme,
  contrastColorFor,
  loadTheme,
  saveTheme,
} from './theme'

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
  document.documentElement.style.removeProperty('--accent')
  document.documentElement.style.removeProperty('--accent-contrast')
})

describe('loadTheme / saveTheme', () => {
  it('round-trips through localStorage', () => {
    saveTheme({ mode: 'dark', preset: 'ocean', accent: '#ff0000', accentContrast: '#ffffff' })
    expect(loadTheme()).toEqual({
      mode: 'dark',
      preset: 'ocean',
      accent: '#ff0000',
      accentContrast: '#ffffff',
    })
  })

  it('falls back to defaults when storage is empty', () => {
    expect(loadTheme()).toEqual(DEFAULT_THEME)
  })

  it('falls back to defaults on invalid stored values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ mode: 'neon', preset: 'nope' }))
    expect(loadTheme()).toEqual(DEFAULT_THEME)
    localStorage.setItem(THEME_STORAGE_KEY, 'not json')
    expect(loadTheme()).toEqual(DEFAULT_THEME)
  })
})

describe('applyTheme', () => {
  it('sets data attributes for explicit modes', () => {
    applyTheme({ mode: 'dark', preset: 'forest', accent: null, accentContrast: null })
    expect(document.documentElement.dataset.mode).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('forest')
  })

  it('resolves system mode via matchMedia', () => {
    applyTheme({ mode: 'system', preset: 'graphite', accent: null, accentContrast: null })
    expect(document.documentElement.dataset.mode).toBe('light')
  })

  it('applies and clears custom accent overrides', () => {
    applyTheme({ mode: 'light', preset: 'ocean', accent: '#123456', accentContrast: '#ffffff' })
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#123456')

    applyTheme({ mode: 'light', preset: 'ocean', accent: null, accentContrast: null })
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('')
  })
})

describe('contrastColorFor', () => {
  it('picks dark text on light accents and white on dark accents', () => {
    expect(contrastColorFor('#ffff00')).toBe('#18181b')
    expect(contrastColorFor('#1e3a8a')).toBe('#ffffff')
  })
})
