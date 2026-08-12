import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { QueryResult, Visualization } from '@/lib/api'
import { CustomWidgetResult } from './CustomWidgetView'

/**
 * The result is self-describing, so one renderer draws any query the editor can
 * build. These check the four forms survive the shapes that actually occur:
 * several metrics, a missing value, and an ungrouped single row.
 */

const result = (overrides: Partial<QueryResult> = {}): QueryResult => ({
  columns: [
    { key: 'group', label: 'Week', kind: 'group', unit: 'none' },
    { key: 'm1', label: 'Tonnage', kind: 'metric', unit: 'weight' },
  ],
  rows: [
    { group: '2026-W30', m1: 4200 },
    { group: '2026-W31', m1: 5100 },
  ],
  group_by: 'week',
  truncated: false,
  ...overrides,
})

function renderResult(visualization: Visualization, data = result()) {
  return render(<CustomWidgetResult widget={{ visualization }} result={data} />)
}

afterEach(() => {
  localStorage.clear()
})

describe('CustomWidgetResult', () => {
  it.each(['bar', 'line', 'table', 'stat'] as const)('renders as a %s', (visualization) => {
    expect(() => renderResult(visualization)).not.toThrow()
  })

  it('shows every group and metric in the table', () => {
    renderResult('table')

    expect(screen.getByRole('columnheader', { name: /Week/ })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: /Tonnage/ })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '2026-W30' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '4,200' })).toBeInTheDocument()
  })

  it('renders a missing metric as a dash, never as zero', () => {
    renderResult('table', result({ rows: [{ group: '2026-W30', m1: null }] }))
    expect(screen.getByRole('cell', { name: '—' })).toBeInTheDocument()
  })

  it('converts weights to pounds for an imperial reader', () => {
    localStorage.setItem('openrep.units', 'imperial')
    renderResult('table', result({ rows: [{ group: '2026-W30', m1: 100 }] }))

    expect(screen.getByRole('columnheader', { name: /lb/ })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '220.5' })).toBeInTheDocument()
  })

  it('drops the group column when there is nothing to group by', () => {
    renderResult(
      'table',
      result({ group_by: 'none', rows: [{ group: null, m1: 9300 }] }),
    )
    expect(screen.getAllByRole('columnheader')).toHaveLength(1)
  })

  it('leads the stat view with the first row after sorting', () => {
    renderResult('stat')

    expect(screen.getByText('Tonnage')).toBeInTheDocument()
    expect(screen.getByText('4,200')).toBeInTheDocument()
    // Names the group it belongs to, rather than dropping it silently.
    expect(screen.getByText(/2026-W30/)).toBeInTheDocument()
  })

  it('compacts a big number rather than letting it spill out of the tile', () => {
    renderResult('stat', result({ rows: [{ group: '2026-W30', m1: 1234567 }] }))

    expect(screen.getByText('1.2M')).toBeInTheDocument()
    // Compacting must not lose the figure: the exact one sits underneath.
    expect(screen.getByText('1,234,567')).toBeInTheDocument()
  })

  it('shows a number that already fits exactly, with no redundant hint', () => {
    renderResult('stat', result({ rows: [{ group: '2026-W30', m1: 830 }] }))

    expect(screen.getByText('830')).toBeInTheDocument()
    expect(screen.queryByText('830.00')).not.toBeInTheDocument()
  })

  it('says when the result was cut short', () => {
    renderResult('table', result({ truncated: true }))
    expect(screen.getByText(/add a limit to this widget/)).toBeInTheDocument()
  })

  it('does not claim truncation when the whole result fits', () => {
    renderResult('table')
    expect(screen.queryByText(/add a limit to this widget/)).not.toBeInTheDocument()
  })
})
