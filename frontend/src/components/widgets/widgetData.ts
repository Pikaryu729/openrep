import type { RangeDays } from '@/lib/dashboard'
import { startDateForDays } from '@/lib/widgetQuery'

/**
 * A `range_days` option as an explicit start date.
 *
 * Computed on the client on purpose: the server would resolve "today" against
 * its own clock and timezone, and every other date in this app is a local
 * calendar day (see lib/format.ts). Custom widgets resolve their own window
 * the same way, so the day arithmetic itself lives in lib/widgetQuery.ts.
 */
export function rangeStart(rangeDays: RangeDays, today = new Date()): string | null {
  return startDateForDays(rangeDays, today)
}

/** Human label for a range option. */
export function rangeLabel(rangeDays: RangeDays): string {
  return rangeDays == null ? 'All time' : `Last ${rangeDays} days`
}
