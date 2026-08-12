import { afterEach, describe, expect, it, vi } from 'vitest'
import { longDate, parseIsoDate, shortDate } from './format'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('parseIsoDate', () => {
  it('reads an API date as a local calendar date', () => {
    // `new Date('2026-08-11')` is UTC midnight, which is still the 10th in
    // Chicago — the whole reason this helper exists.
    vi.stubEnv('TZ', 'America/Chicago')
    const parsed = parseIsoDate('2026-08-11')
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(7)
    expect(parsed.getDate()).toBe(11)
  })

  it('does not shift the day east of Greenwich either', () => {
    vi.stubEnv('TZ', 'Asia/Tokyo')
    expect(parseIsoDate('2026-01-01').getDate()).toBe(1)
  })
})

describe('formatters', () => {
  it('formats a short and long date without drifting a day', () => {
    vi.stubEnv('TZ', 'America/Chicago')
    expect(shortDate('2026-08-11')).toContain('11')
    expect(longDate('2026-08-11')).toContain('2026')
    expect(longDate('2026-08-11')).toContain('11')
  })
})
