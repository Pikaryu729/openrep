import type { RangeDays } from '@/lib/dashboard'

/**
 * A `range_days` option as an explicit start date.
 *
 * Computed on the client on purpose: the server would resolve "today" against
 * its own clock and timezone, and every other date in this app is a local
 * calendar day (see lib/format.ts).
 */
export function rangeStart(rangeDays: RangeDays, today = new Date()): string | null {
  if (rangeDays == null) return null
  const start = new Date(today)
  start.setDate(start.getDate() - (rangeDays - 1))
  return start.toLocaleDateString('en-CA')
}

/** Human label for a range option. */
export function rangeLabel(rangeDays: RangeDays): string {
  return rangeDays == null ? 'All time' : `Last ${rangeDays} days`
}
