import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useIsMobile } from './use-mobile'

describe('useIsMobile', () => {
  let matches = false
  let notifyChange: (() => void) | undefined

  beforeEach(() => {
    matches = false
    notifyChange = undefined
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        get matches() {
          return matches
        },
        addEventListener: (_type: string, listener: () => void) => {
          notifyChange = listener
        },
        removeEventListener: vi.fn(),
      }),
    )
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 375,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uses the media query state for initial and breakpoint updates', () => {
    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)

    act(() => {
      matches = true
      notifyChange?.()
    })

    expect(result.current).toBe(true)
  })
})
