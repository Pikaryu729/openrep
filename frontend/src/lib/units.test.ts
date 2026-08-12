import { afterEach, describe, expect, it } from 'vitest'
import { UNITS_STORAGE_KEY, displayToKg, kgToDisplay, loadUnits, saveUnits, weightUnit } from './units'

afterEach(() => {
  localStorage.clear()
})

describe('units preference', () => {
  it('defaults to metric', () => {
    expect(loadUnits()).toBe('metric')
  })

  it('round-trips through localStorage', () => {
    saveUnits('imperial')
    expect(localStorage.getItem(UNITS_STORAGE_KEY)).toBe('imperial')
    expect(loadUnits()).toBe('imperial')
  })

  it('falls back to metric on invalid stored values', () => {
    localStorage.setItem(UNITS_STORAGE_KEY, 'stone')
    expect(loadUnits()).toBe('metric')
  })
})

describe('conversions', () => {
  it('passes metric through untouched', () => {
    expect(kgToDisplay(102.5, 'metric')).toBe(102.5)
    expect(displayToKg(102.5, 'metric')).toBe(102.5)
    expect(weightUnit('metric')).toBe('kg')
  })

  it('converts kg to pounds for display', () => {
    expect(kgToDisplay(100, 'imperial')).toBe(220.5)
    expect(kgToDisplay(60, 'imperial')).toBe(132.3)
    expect(weightUnit('imperial')).toBe('lb')
  })

  it('converts entered pounds back to kg', () => {
    expect(displayToKg(225, 'imperial')).toBe(102.06)
    expect(displayToKg(45, 'imperial')).toBe(20.41)
  })
})
