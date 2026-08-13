import { describe, expect, it } from 'vitest'
import type { QueryCatalog, QueryFieldInfo, WidgetQuery } from './api'
import {
  blankQuery,
  chronological,
  coerceFilterValue,
  describeQuery,
  formatGroup,
  formatMetric,
  formatStatValue,
  isTemporal,
  metricLabel,
  nextMetricKey,
  queryProblems,
  startDateForDays,
  toChartRows,
  toDisplayValue,
  unitSuffix,
} from './widgetQuery'

const field = (
  key: string,
  overrides: Partial<QueryFieldInfo> = {},
): QueryFieldInfo => ({
  key,
  label: key,
  kind: 'number',
  unit: 'count',
  aggregatable: true,
  description: '',
  ops: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'is_null', 'not_null'],
  aggregates: ['sum', 'avg', 'min', 'max', 'count_distinct'],
  ...overrides,
})

const CATALOG: QueryCatalog = {
  fields: [
    field('volume', { label: 'Volume', unit: 'weight' }),
    field('reps', { label: 'Reps', unit: 'reps' }),
    field('category', {
      label: 'Category',
      kind: 'text',
      unit: 'none',
      aggregatable: false,
      ops: ['eq', 'ne', 'contains', 'in', 'is_null', 'not_null'],
      aggregates: [],
    }),
    field('workout_id', { label: 'Session', aggregates: ['count_distinct'] }),
  ],
  group_by: [
    { value: 'none', label: 'No grouping (one total)' },
    { value: 'week', label: 'Week' },
    { value: 'exercise', label: 'Exercise' },
  ],
  aggregates: [
    { value: 'sum', label: 'Total' },
    { value: 'avg', label: 'Average' },
    { value: 'max', label: 'Highest' },
    { value: 'count', label: 'Count of sets' },
    { value: 'count_distinct', label: 'Distinct count' },
  ],
  visualizations: [{ value: 'bar', label: 'Bar chart' }],
  range_days: [30, 90, 365],
  rep_ranges: ['1-3', '4-6'],
  max_filters: 8,
  max_metrics: 4,
  max_rows: 500,
}

describe('startDateForDays', () => {
  it('counts the window inclusively from a local calendar day', () => {
    // 30 days ending today includes today, so the start is 29 days back.
    expect(startDateForDays(30, new Date(2026, 7, 12))).toBe('2026-07-14')
  })

  it('is null for all-time', () => {
    expect(startDateForDays(null)).toBeNull()
  })

  it('does not drift across a month or year boundary', () => {
    expect(startDateForDays(1, new Date(2026, 0, 1))).toBe('2026-01-01')
    expect(startDateForDays(2, new Date(2026, 0, 1))).toBe('2025-12-31')
  })
})

describe('nextMetricKey', () => {
  it('fills the first free slot rather than counting the list', () => {
    const metrics = [
      { key: 'm1', agg: 'sum' as const, field: 'volume', label: null },
      { key: 'm3', agg: 'sum' as const, field: 'volume', label: null },
    ]
    expect(nextMetricKey(metrics)).toBe('m2')
  })
})

describe('coerceFilterValue', () => {
  const numeric = field('reps')
  const text = field('category', { kind: 'text' })

  it('drops the value entirely for the blank checks', () => {
    expect(coerceFilterValue({ field: 'reps', op: 'is_null', value: 5 }, numeric)).toBeNull()
  })

  it('turns text into a number when the field is numeric', () => {
    expect(coerceFilterValue({ field: 'reps', op: 'eq', value: '8' }, numeric)).toBe(8)
  })

  it('falls back rather than sending NaN', () => {
    expect(coerceFilterValue({ field: 'reps', op: 'eq', value: 'eight' }, numeric)).toBe(0)
  })

  it('collapses a list to a scalar when the operator stops taking one', () => {
    expect(coerceFilterValue({ field: 'reps', op: 'eq', value: [1, 2] }, numeric)).toBe(0)
    expect(coerceFilterValue({ field: 'category', op: 'eq', value: ['a'] }, text)).toBe('')
  })

  it('keeps a list for "is one of"', () => {
    expect(coerceFilterValue({ field: 'reps', op: 'in', value: [1, 2] }, numeric)).toEqual([1, 2])
  })
})

describe('queryProblems', () => {
  const valid = (): WidgetQuery => blankQuery()

  it('passes a blank query, so a new widget starts usable', () => {
    expect(queryProblems(valid(), CATALOG)).toEqual([])
  })

  it('flags a metric with no field', () => {
    const query = { ...valid(), metrics: [{ key: 'm1', agg: 'sum' as const, field: null, label: null }] }
    expect(queryProblems(query, CATALOG)).toHaveLength(1)
  })

  it('flags a field the aggregate cannot use', () => {
    const query = {
      ...valid(),
      metrics: [{ key: 'm1', agg: 'sum' as const, field: 'category', label: null }],
    }
    expect(queryProblems(query, CATALOG)[0]).toContain('cannot be used with')
  })

  it('does not ask a row count for a field', () => {
    const query = {
      ...valid(),
      metrics: [{ key: 'm1', agg: 'count' as const, field: null, label: null }],
    }
    expect(queryProblems(query, CATALOG)).toEqual([])
  })

  it('flags a filter left without a value', () => {
    const query = { ...valid(), filters: [{ field: 'reps', op: 'gte' as const, value: '' }] }
    expect(queryProblems(query, CATALOG)[0]).toContain('value')
  })

  it('does not ask the blank checks for a value', () => {
    const query = { ...valid(), filters: [{ field: 'reps', op: 'is_null' as const, value: null }] }
    expect(queryProblems(query, CATALOG)).toEqual([])
  })

  it('flags an empty "is one of" list', () => {
    const query = { ...valid(), filters: [{ field: 'reps', op: 'in' as const, value: [] }] }
    expect(queryProblems(query, CATALOG)[0]).toContain('at least one value')
  })

  it('flags a sort pointing at a metric that was removed', () => {
    const query = { ...valid(), sort: { by: 'gone', direction: 'asc' as const } }
    expect(queryProblems(query, CATALOG)[0]).toContain('no longer exists')
  })
})

describe('metricLabel', () => {
  it('prefers the user label', () => {
    expect(
      metricLabel({ key: 'm1', agg: 'sum', field: 'volume', label: 'Tonnage' }, CATALOG),
    ).toBe('Tonnage')
  })

  it('falls back to the aggregate and field', () => {
    expect(metricLabel({ key: 'm1', agg: 'sum', field: 'volume', label: null }, CATALOG)).toBe(
      'Total volume',
    )
  })

  it('names a row count without a field', () => {
    expect(metricLabel({ key: 'm1', agg: 'count', field: null, label: null }, CATALOG)).toBe(
      'Count of sets',
    )
  })
})

describe('describeQuery', () => {
  it('reads as a sentence', () => {
    expect(describeQuery(blankQuery(), CATALOG)).toBe('Total volume by week · last 90 days')
  })

  it('mentions filters and drops the grouping when there is none', () => {
    const query: WidgetQuery = {
      ...blankQuery(),
      group_by: 'none',
      range_days: null,
      filters: [{ field: 'reps', op: 'gte', value: 5 }],
    }
    expect(describeQuery(query, CATALOG)).toBe('Total volume · all time · 1 filter')
  })
})

describe('formatGroup', () => {
  it('names the ungrouped total', () => {
    expect(formatGroup(null, 'none')).toBe('Total')
  })

  it('formats a month key as a month', () => {
    expect(formatGroup('2026-01', 'month')).toMatch(/Jan/)
  })

  it('leaves already-readable groups alone', () => {
    expect(formatGroup('2026-W02', 'week')).toBe('2026-W02')
    expect(formatGroup('Back Squat', 'exercise')).toBe('Back Squat')
  })
})

describe('formatMetric', () => {
  it('renders a missing value as a dash, never as zero', () => {
    expect(formatMetric(null)).toBe('—')
    expect(formatMetric(0)).toBe('0')
  })
})

describe('formatStatValue', () => {
  it('leaves a number that fits exactly alone', () => {
    expect(formatStatValue(830)).toEqual({ display: '830', exact: null })
    expect(formatStatValue(9999)).toEqual({ display: '9,999', exact: null })
  })

  it('compacts a number too long for a tile, keeping the exact one', () => {
    // All-time volume runs to seven digits and used to spill out of the card.
    expect(formatStatValue(1234567)).toEqual({ display: '1.2M', exact: '1,234,567' })
    expect(formatStatValue(12480)).toEqual({ display: '12.5K', exact: '12,480' })
  })

  it('compacts large negatives too', () => {
    expect(formatStatValue(-50000).display).toBe('-50K')
  })

  it('still renders a missing value as a dash', () => {
    expect(formatStatValue(null)).toEqual({ display: '—', exact: null })
  })
})

describe('units at the display boundary', () => {
  it('converts weights and leaves everything else alone', () => {
    expect(toDisplayValue(100, 'weight', 'imperial')).toBeCloseTo(220.5, 1)
    expect(toDisplayValue(100, 'weight', 'metric')).toBe(100)
    expect(toDisplayValue(10, 'reps', 'imperial')).toBe(10)
  })

  it('leaves null null rather than converting it to 0', () => {
    expect(toDisplayValue(null, 'weight', 'imperial')).toBeNull()
  })

  it('labels the unit for the reader', () => {
    expect(unitSuffix('weight', 'imperial')).toBe('lb')
    expect(unitSuffix('weight', 'metric')).toBe('kg')
    expect(unitSuffix('count', 'metric')).toBe('')
  })
})

describe('chart shaping', () => {
  const columns = [
    { key: 'group', unit: 'none' as const, kind: 'group' },
    { key: 'm1', unit: 'weight' as const, kind: 'metric' },
  ]

  it('converts metric values and pre-formats the group', () => {
    const rows = toChartRows(
      [{ group: '2026-08-11', m1: 100 }],
      columns,
      'day',
      'metric',
    )
    expect(rows[0].m1).toBe(100)
    expect(rows[0].groupRaw).toBe('2026-08-11')
    expect(rows[0].group).not.toBe('2026-08-11') // formatted for the axis
  })

  it('keeps a missing metric null so the line breaks instead of dipping to zero', () => {
    const rows = toChartRows([{ group: '2026-08-11', m1: null }], columns, 'day', 'metric')
    expect(rows[0].m1).toBeNull()
  })

  it('sorts a time axis forwards whatever order the rows arrived in', () => {
    const rows = [{ group: '2026-03' }, { group: '2026-01' }, { group: '2026-02' }]
    expect(chronological(rows, 'month').map((row) => row.group)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ])
  })

  it('leaves a categorical axis in the order the query sorted it', () => {
    const rows = [{ group: 'Zercher' }, { group: 'Back Squat' }]
    expect(chronological(rows, 'exercise')).toBe(rows)
    expect(isTemporal('exercise')).toBe(false)
    expect(isTemporal('week')).toBe(true)
  })
})
