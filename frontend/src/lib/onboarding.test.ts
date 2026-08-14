import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '@/lib/api'
import {
  ONBOARDING_STORAGE_KEY,
  decideFirstRun,
  loadOnboardingFlag,
  saveOnboardingFlag,
  useOnboardingGate,
} from './onboarding'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    api: {
      exercises: { list: vi.fn() },
      workouts: { list: vi.fn() },
    },
  }
})

afterEach(() => {
  vi.resetAllMocks()
  vi.restoreAllMocks()
  localStorage.clear()
})

const EXERCISE = { id: 1, name: 'Bench Press', category: 'chest', notes: null }

function renderGate() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children)
  return { queryClient, ...renderHook(() => useOnboardingGate(), { wrapper }) }
}

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

  it('does not throw when storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => saveOnboardingFlag('done')).not.toThrow()
  })
})

describe('decideFirstRun', () => {
  it('sends a fresh database to the wizard', () => {
    expect(decideFirstRun(true, true)).toBe('wizard')
  })

  it('sends existing data to the app and marks onboarding done', () => {
    expect(decideFirstRun(false, true)).toBe('app-mark-done')
    expect(decideFirstRun(true, false)).toBe('app-mark-done')
    expect(decideFirstRun(false, false)).toBe('app-mark-done')
  })

  it('renders the app without persisting anything when a probe failed', () => {
    expect(decideFirstRun(undefined, true)).toBe('app')
    expect(decideFirstRun(true, undefined)).toBe('app')
    expect(decideFirstRun(undefined, undefined)).toBe('app')
  })
})

describe('useOnboardingGate', () => {
  it('renders the app immediately when done, without running the probe queries', () => {
    saveOnboardingFlag('done')

    const { result } = renderGate()

    expect(result.current.status).toBe('app')
    expect(api.exercises.list).not.toHaveBeenCalled()
    expect(api.workouts.list).not.toHaveBeenCalled()
  })

  it('holds at pending, then shows the wizard for a fresh database', async () => {
    vi.mocked(api.exercises.list).mockResolvedValue([])
    vi.mocked(api.workouts.list).mockResolvedValue([])

    const { result } = renderGate()

    expect(result.current.status).toBe('pending')
    await waitFor(() => expect(result.current.status).toBe('wizard'))
    // Nothing persisted: the wizard's own exit paths write 'done'.
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull()
  })

  it('self-heals a pre-feature install: existing data renders the app and persists done', async () => {
    vi.mocked(api.exercises.list).mockResolvedValue([EXERCISE])
    vi.mocked(api.workouts.list).mockResolvedValue([])

    const { result } = renderGate()

    await waitFor(() => expect(result.current.status).toBe('app'))
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe('done')
  })

  it('renders the app on a failed probe, persists nothing, and stays decided when data later reads empty', async () => {
    vi.mocked(api.exercises.list).mockRejectedValue(new ApiError(500, 'backend down'))
    vi.mocked(api.workouts.list).mockResolvedValue([])

    const { result, queryClient, rerender } = renderGate()

    await waitFor(() => expect(result.current.status).toBe('app'))
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull()

    // Both lists confirmed empty mid-session must NOT re-summon the wizard:
    // the decision is per-session, not derived from query data.
    act(() => {
      queryClient.setQueryData(['exercises'], [])
      queryClient.setQueryData(['workouts'], [])
    })
    rerender()
    expect(result.current.status).toBe('app')
  })

  it('replay wins at any time, even after an app decision with existing data', async () => {
    vi.mocked(api.exercises.list).mockResolvedValue([EXERCISE])
    vi.mocked(api.workouts.list).mockResolvedValue([])

    const { result } = renderGate()
    await waitFor(() => expect(result.current.status).toBe('app'))

    act(() => saveOnboardingFlag('replay'))

    expect(result.current.status).toBe('wizard')
    // Finishing the replayed wizard hands the app back.
    act(() => {
      saveOnboardingFlag('done')
      result.current.onDone()
    })
    expect(result.current.status).toBe('app')
  })

  it('lets the wizard exit even when persisting done fails', () => {
    saveOnboardingFlag('replay')
    const { result } = renderGate()
    expect(result.current.status).toBe('wizard')

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage full')
    })
    act(() => {
      // What the wizard's exit paths do: save (which fails silently), then
      // report done. The user must still land in the app.
      saveOnboardingFlag('done')
      result.current.onDone()
    })

    expect(result.current.status).toBe('app')
  })
})
