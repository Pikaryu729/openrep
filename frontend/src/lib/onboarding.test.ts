import { afterEach, describe, expect, it } from 'vitest'
import {
  ONBOARDING_STORAGE_KEY,
  loadOnboardingFlag,
  saveOnboardingFlag,
  shouldShowOnboarding,
} from './onboarding'

afterEach(() => {
  localStorage.clear()
})

describe('onboarding flag persistence', () => {
  it('defaults to null when nothing is stored', () => {
    expect(loadOnboardingFlag()).toBeNull()
  })

  it('round-trips both flag values', () => {
    saveOnboardingFlag('done')
    expect(loadOnboardingFlag()).toBe('done')

    saveOnboardingFlag('replay')
    expect(loadOnboardingFlag()).toBe('replay')
  })

  it('treats an unknown stored value as absent', () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'garbage')
    expect(loadOnboardingFlag()).toBeNull()
  })
})

describe('shouldShowOnboarding', () => {
  it('always shows on replay, even with existing data', () => {
    expect(shouldShowOnboarding('replay', false, false)).toBe(true)
    expect(shouldShowOnboarding('replay', undefined, undefined)).toBe(true)
  })

  it('never shows once done, even for an empty database', () => {
    expect(shouldShowOnboarding('done', true, true)).toBe(false)
  })

  it('shows for a fresh database when the flag is absent', () => {
    expect(shouldShowOnboarding(null, true, true)).toBe(true)
  })

  it('does not show when either list has data', () => {
    expect(shouldShowOnboarding(null, false, true)).toBe(false)
    expect(shouldShowOnboarding(null, true, false)).toBe(false)
  })

  it('does not show while queries are pending or failed', () => {
    expect(shouldShowOnboarding(null, undefined, true)).toBe(false)
    expect(shouldShowOnboarding(null, true, undefined)).toBe(false)
    expect(shouldShowOnboarding(null, undefined, undefined)).toBe(false)
  })
})
