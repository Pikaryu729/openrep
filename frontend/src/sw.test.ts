import { beforeAll, describe, expect, it, vi } from 'vitest'

const skipWaitingSpy = vi.fn()

// sw.ts reads self.__WB_MANIFEST and registers its listeners at module load
// time, so the service-worker globals must be stubbed before the import.
beforeAll(async () => {
  const scope = self as unknown as ServiceWorkerGlobalScope
  scope.__WB_MANIFEST = []
  scope.skipWaiting = skipWaitingSpy
  await import('./sw')
})

describe('service worker update activation', () => {
  it('skips waiting when the window posts a SKIP_WAITING message', () => {
    skipWaitingSpy.mockClear()

    self.dispatchEvent(
      new MessageEvent('message', { data: { type: 'SKIP_WAITING' } }),
    )

    expect(skipWaitingSpy).toHaveBeenCalledTimes(1)
  })

  it('does not skip waiting for unrelated messages', () => {
    skipWaitingSpy.mockClear()

    self.dispatchEvent(
      new MessageEvent('message', { data: { type: 'SOME_OTHER_MESSAGE' } }),
    )
    self.dispatchEvent(new MessageEvent('message'))

    expect(skipWaitingSpy).not.toHaveBeenCalled()
  })
})
