import type {
  Aggregate,
  GroupBy,
  QueryCatalog,
  QueryFieldInfo,
  QueryFilter,
  QueryMetric,
  QueryResultRow,
  QueryUnit,
  WidgetQuery,
} from '@/lib/api'
import { compact, longDate, shortDate } from '@/lib/format'
import { kgToDisplay, type UnitSystem } from '@/lib/units'

/**
 * Client-side half of the custom-widget query language.
 *
 * The server owns what is *legal* (schemas/widget_query.py, published at
 * /api/widgets/fields). This module owns what is *editable and readable*:
 * blank values the editor starts from, the human phrasing of a query, and how
 * a result row turns into something a chart or a table can show.
 */

/** Operators that take no value, so the editor hides the value input. */
export const VALUELESS_OPS = new Set(['is_null', 'not_null'])
/** The one operator that takes a list. */
export const LIST_OPS = new Set(['in'])
/** The one aggregate that needs no field: it counts rows. */
export const FIELDLESS_AGGREGATES = new Set(['count'])

export function opNeedsValue(op: string): boolean {
  return !VALUELESS_OPS.has(op)
}

export function opTakesList(op: string): boolean {
  return LIST_OPS.has(op)
}

export function aggNeedsField(agg: string): boolean {
  return !FIELDLESS_AGGREGATES.has(agg)
}

/**
 * A rolling window as an explicit start date.
 *
 * Resolved here, on the client, on purpose: the server would resolve "today"
 * against its own clock and timezone, while every date in this app is a local
 * calendar day (see lib/format.ts). Shared with the built-in widgets via
 * `rangeStart` in components/widgets/widgetData.ts.
 */
export function startDateForDays(days: number | null, today = new Date()): string | null {
  if (days == null) return null
  const start = new Date(today)
  start.setDate(start.getDate() - (days - 1))
  return start.toLocaleDateString('en-CA')
}

// --- blanks the editor starts from ------------------------------------------

/** A query that already returns something, so a new widget is never a blank
 * screen: total volume per week over the last 90 days. */
export function blankQuery(): WidgetQuery {
  return {
    source: 'sets',
    filters: [],
    group_by: 'week',
    metrics: [{ key: 'm1', agg: 'sum', field: 'volume', label: null }],
    sort: { by: 'group', direction: 'asc' },
    limit: null,
    range_days: 90,
  }
}

/** Metric keys are generated, never typed: they are row keys in the result,
 * and the server requires them unique and `^[a-z][a-z0-9_]*$`. */
export function nextMetricKey(metrics: QueryMetric[]): string {
  const used = new Set(metrics.map((metric) => metric.key))
  for (let index = 1; index <= 99; index += 1) {
    const key = `m${index}`
    if (!used.has(key)) return key
  }
  return `m${Date.now()}`
}

export function blankMetric(metrics: QueryMetric[], catalog: QueryCatalog): QueryMetric {
  const field = catalog.fields.find((entry) => entry.aggregates.includes('sum'))
  return {
    key: nextMetricKey(metrics),
    agg: field ? 'sum' : 'count',
    field: field?.key ?? null,
    label: null,
  }
}

export function blankFilter(catalog: QueryCatalog): QueryFilter {
  const field = catalog.fields[0]
  return { field: field.key, op: 'eq', value: field.kind === 'number' ? 0 : '' }
}

/** Coerce a filter's value when its field or operator changes, so switching
 * "Exercise name contains" to "Reps is at least" never leaves text in a
 * number filter for the server to reject. */
export function coerceFilterValue(
  filter: QueryFilter,
  field: QueryFieldInfo,
): QueryFilter['value'] {
  if (!opNeedsValue(filter.op)) return null
  if (opTakesList(filter.op)) {
    return Array.isArray(filter.value) ? filter.value : []
  }
  if (Array.isArray(filter.value)) return field.kind === 'number' ? 0 : ''
  if (field.kind === 'number') {
    const numeric = typeof filter.value === 'number' ? filter.value : Number(filter.value)
    return Number.isFinite(numeric) ? numeric : 0
  }
  return filter.value == null ? '' : String(filter.value)
}

// --- validation -------------------------------------------------------------

/**
 * Problems that would make the server reject this query, phrased for the user.
 *
 * The server is still the authority — it re-validates everything. This exists
 * so the editor can disable Save and say why, instead of round-tripping to a
 * 422 the user has to decode.
 */
export function queryProblems(query: WidgetQuery, catalog: QueryCatalog): string[] {
  const problems: string[] = []
  const fields = new Map(catalog.fields.map((field) => [field.key, field]))

  if (query.metrics.length === 0) {
    problems.push('Add at least one metric — a widget with nothing to measure has nothing to show.')
  }
  if (query.metrics.length > catalog.max_metrics) {
    problems.push(`A widget holds at most ${catalog.max_metrics} metrics.`)
  }
  if (query.filters.length > catalog.max_filters) {
    problems.push(`A widget holds at most ${catalog.max_filters} filters.`)
  }

  for (const metric of query.metrics) {
    if (!aggNeedsField(metric.agg)) continue
    const field = metric.field ? fields.get(metric.field) : undefined
    if (!field) {
      problems.push(`Choose what to ${aggregateLabel(metric.agg, catalog).toLowerCase()}.`)
    } else if (!field.aggregates.includes(metric.agg)) {
      problems.push(`${field.label} cannot be used with "${aggregateLabel(metric.agg, catalog)}".`)
    }
  }

  for (const filter of query.filters) {
    if (!opNeedsValue(filter.op)) continue
    const field = fields.get(filter.field)
    if (opTakesList(filter.op)) {
      if (!Array.isArray(filter.value) || filter.value.length === 0) {
        problems.push(`Give "${field?.label ?? filter.field} is one of" at least one value.`)
      }
    } else if (filter.value === '' || filter.value == null) {
      problems.push(`Give the ${field?.label ?? filter.field} filter a value.`)
    }
  }

  const keys = query.metrics.map((metric) => metric.key)
  if (query.sort.by !== 'group' && !keys.includes(query.sort.by)) {
    problems.push('Sorting is set to a metric that no longer exists — pick another.')
  }

  return problems
}

// --- reading a query back ----------------------------------------------------

export function aggregateLabel(agg: Aggregate, catalog: QueryCatalog): string {
  return catalog.aggregates.find((choice) => choice.value === agg)?.label ?? agg
}

export function groupByLabel(groupBy: GroupBy, catalog: QueryCatalog): string {
  return catalog.group_by.find((choice) => choice.value === groupBy)?.label ?? groupBy
}

export function metricLabel(metric: QueryMetric, catalog: QueryCatalog): string {
  if (metric.label) return metric.label
  const agg = aggregateLabel(metric.agg, catalog)
  if (!aggNeedsField(metric.agg)) return agg
  const field = catalog.fields.find((entry) => entry.key === metric.field)
  return field ? `${agg} ${field.label.toLowerCase()}` : agg
}

export function rangeLabelForDays(days: number | null): string {
  return days == null ? 'All time' : `Last ${days} days`
}

/** A one-line plain-English summary, for the widget list and the editor header. */
export function describeQuery(query: WidgetQuery, catalog: QueryCatalog): string {
  const metrics = query.metrics.map((metric) => metricLabel(metric, catalog)).join(', ')
  const parts = [metrics || 'Nothing measured']
  if (query.group_by !== 'none') {
    parts.push(`by ${groupByLabel(query.group_by, catalog).toLowerCase()}`)
  }
  parts.push(`· ${rangeLabelForDays(query.range_days).toLowerCase()}`)
  if (query.filters.length > 0) {
    parts.push(`· ${query.filters.length} filter${query.filters.length === 1 ? '' : 's'}`)
  }
  return parts.join(' ')
}

// --- reading a result back ---------------------------------------------------

/** Group keys are machine-stable (`2026-W02`, `2026-01`); this is the display
 * form. Only day and month need real work — the rest are already words. */
export function formatGroup(group: string | null, groupBy: GroupBy): string {
  if (group == null) return 'Total'
  switch (groupBy) {
    case 'day':
      return shortDate(group)
    case 'month': {
      const [year, month] = group.split('-').map(Number)
      return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      })
    }
    default:
      return group
  }
}

/** The long form, for tooltips where there is room to be unambiguous. */
export function formatGroupLong(group: string | null, groupBy: GroupBy): string {
  if (group == null) return 'Total'
  return groupBy === 'day' ? longDate(group) : formatGroup(group, groupBy)
}

/** Weight metrics are stored in kg and converted at the display boundary, the
 * same rule every other number in this app follows (see lib/units.ts). */
export function toDisplayValue(
  value: number | null,
  unit: QueryUnit,
  units: UnitSystem,
): number | null {
  if (value == null) return null
  return unit === 'weight' ? kgToDisplay(value, units) : value
}

export function unitSuffix(unit: QueryUnit, units: UnitSystem): string {
  switch (unit) {
    case 'weight':
      return units === 'metric' ? 'kg' : 'lb'
    case 'reps':
      return 'reps'
    case 'rpe':
      return 'RPE'
    default:
      return ''
  }
}

/** A metric cell. Null is "no data for this group", which is not zero — see
 * the note on QueryResult.rows in the backend schema. */
export function formatMetric(value: number | null): string {
  if (value == null) return '—'
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value)
}

/** Past this, the exact number stops fitting a tile at `text-2xl`. */
const COMPACT_THRESHOLD = 10_000

/**
 * A metric as a headline number.
 *
 * Compacted once the exact form outgrows the tile — all-time volume runs to
 * seven digits, and the built-in summary tiles already read that way
 * (`compact` in lib/format.ts). `exact` is the full rendering when compacting
 * actually dropped something, so the tile can show it underneath rather than
 * quietly losing the precision; it is null when `display` is already exact.
 */
export function formatStatValue(value: number | null): { display: string; exact: string | null } {
  if (value == null) return { display: '—', exact: null }
  const exact = formatMetric(value)
  if (Math.abs(value) < COMPACT_THRESHOLD) return { display: exact, exact: null }
  return { display: compact(value), exact }
}

/** Result rows → recharts rows, with weights converted and the group
 * pre-formatted so the axis and the tooltip agree. */
export function toChartRows(
  rows: QueryResultRow[],
  columns: { key: string; unit: QueryUnit; kind: string }[],
  groupBy: GroupBy,
  units: UnitSystem,
): Record<string, string | number | null>[] {
  const metrics = columns.filter((column) => column.kind === 'metric')
  return rows.map((row) => {
    const point: Record<string, string | number | null> = {
      group: formatGroup(row.group, groupBy),
      groupRaw: row.group,
    }
    for (const metric of metrics) {
      const value = row[metric.key]
      point[metric.key] = toDisplayValue(typeof value === 'number' ? value : null, metric.unit, units)
    }
    return point
  })
}

/** Dates in a chart read as a series; everything else reads as categories.
 * Used to stop a line chart drawing a slope between two unrelated exercises. */
export function isTemporal(groupBy: GroupBy): boolean {
  return groupBy === 'day' || groupBy === 'week' || groupBy === 'month'
}

/** Sorted by date ascending regardless of the query's sort, because a time
 * axis running backwards is a bug however the rows arrived. */
export function chronological(rows: QueryResultRow[], groupBy: GroupBy): QueryResultRow[] {
  if (!isTemporal(groupBy)) return rows
  return [...rows].sort((left, right) => String(left.group).localeCompare(String(right.group)))
}
