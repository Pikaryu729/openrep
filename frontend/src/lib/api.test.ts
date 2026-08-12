import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './api'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('api client', () => {
  it('parses a successful JSON response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify([{ id: 1, name: 'Deadlift', category: 'back', notes: null }]), {
          status: 200,
        }),
      ),
    )

    const exercises = await api.exercises.list()
    expect(exercises).toEqual([{ id: 1, name: 'Deadlift', category: 'back', notes: null }])
  })

  it('throws ApiError on a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('exercise not found', { status: 404 })),
    )

    await expect(api.exercises.list()).rejects.toBeInstanceOf(ApiError)
  })
})

describe('query string building', () => {
  function captureUrl() {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    return () => String(fetchMock.mock.calls[0][0])
  }

  it('omits absent filters entirely', async () => {
    const url = captureUrl()
    await api.workouts.list()
    expect(url()).toBe('/api/workouts')
  })

  it('drops null and undefined but keeps zero and empty-ish values', async () => {
    const url = captureUrl()
    await api.workouts.list({ limit: 5, start: null, end: undefined, category: 'legs' })
    expect(url()).toBe('/api/workouts?limit=5&category=legs')
  })

  it('encodes values that need it', async () => {
    const url = captureUrl()
    await api.workouts.list({ category: 'upper body & arms' })
    expect(url()).toContain('category=upper+body+%26+arms')
  })

  it('builds analytics ranges', async () => {
    const url = captureUrl()
    await api.analytics.volumeByCategory({ start: '2026-01-01' })
    expect(url()).toBe('/api/analytics/volume-by-category?start=2026-01-01')
  })

  it('keeps the bare volume endpoint unchanged when unfiltered', async () => {
    const url = captureUrl()
    await api.analytics.volumeByDay()
    expect(url()).toBe('/api/analytics/volume')
  })
})
