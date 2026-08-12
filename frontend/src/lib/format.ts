/** Formatting helpers for API date strings (`YYYY-MM-DD`, no time, no zone). */

/**
 * Parse an API date as a *local* calendar date.
 *
 * `new Date('2026-08-11')` is specified to parse as UTC midnight, which renders
 * as the 10th for anyone west of Greenwich — the same off-by-one that used to
 * mis-date new workouts. Splitting the parts and using the local constructor
 * keeps the day the user actually trained.
 */
export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** `2026-08-11` → `Aug 11`. */
export function shortDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Compact large numbers so they stay on one line: 12480 → 12.5K. */
export function compact(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}

/** `2026-08-11` → `Aug 11, 2026`. */
export function longDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
