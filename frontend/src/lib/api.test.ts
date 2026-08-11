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
