import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type QueryCatalog, type QueryResult } from '../lib/api'
import { WidgetEditor } from './WidgetEditor'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    api: {
      widgets: { catalog: vi.fn(), preview: vi.fn() },
      exercises: { list: vi.fn() },
    },
  }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({ to, children }: { to: string; children?: React.ReactNode }) => (
      <a href={to}>{children}</a>
    ),
  }
})

const number = (key: string, label: string, unit: 'weight' | 'reps' | 'count') => ({
  key,
  label,
  kind: 'number' as const,
  unit,
  aggregatable: true,
  description: '',
  ops: ['eq' as const, 'ne' as const, 'gte' as const, 'in' as const, 'is_null' as const],
  aggregates: ['sum' as const, 'avg' as const, 'max' as const, 'count_distinct' as const],
})

const CATALOG: QueryCatalog = {
  fields: [
    number('volume', 'Volume', 'weight'),
    number('reps', 'Reps', 'reps'),
    {
      key: 'category',
      label: 'Category',
      kind: 'text',
      unit: 'none',
      aggregatable: false,
      description: '',
      ops: ['eq', 'contains'],
      aggregates: [],
    },
    {
      key: 'exercise_id',
      label: 'Exercise',
      kind: 'number',
      unit: 'count',
      aggregatable: true,
      description: '',
      ops: ['eq', 'in'],
      aggregates: ['count_distinct'],
    },
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
  visualizations: [
    { value: 'bar', label: 'Bar chart' },
    { value: 'table', label: 'Table' },
  ],
  range_days: [30, 90, 365],
  rep_ranges: ['1-3'],
  max_filters: 8,
  max_metrics: 4,
  max_rows: 500,
}

const RESULT: QueryResult = {
  columns: [
    { key: 'group', label: 'Week', kind: 'group', unit: 'none' },
    { key: 'm1', label: 'Total volume', kind: 'metric', unit: 'weight' },
  ],
  rows: [
    { group: '2026-W30', m1: 4200 },
    { group: '2026-W31', m1: 5100 },
  ],
  group_by: 'week',
  truncated: false,
}

const exercises = [{ id: 4, name: 'Back Squat', category: 'legs', notes: null }]

beforeEach(() => {
  vi.mocked(api.widgets.catalog).mockResolvedValue(CATALOG)
  vi.mocked(api.widgets.preview).mockResolvedValue(RESULT)
  vi.mocked(api.exercises.list).mockResolvedValue(exercises)
})

afterEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
})

function renderEditor(props: Partial<Parameters<typeof WidgetEditor>[0]> = {}) {
  const onSave = vi.fn()
  const onCancel = vi.fn()
  const ui: ReactElement = (
    <WidgetEditor
      saving={false}
      saveError={null}
      onSave={onSave}
      onCancel={onCancel}
      {...props}
    />
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
  return { onSave, onCancel }
}

/** The last query the preview endpoint was asked to run. */
function lastPreviewQuery() {
  const calls = vi.mocked(api.widgets.preview).mock.calls
  return calls[calls.length - 1][0]
}

describe('WidgetEditor', () => {
  it('starts on a query that already returns something', async () => {
    renderEditor()

    await waitFor(() => expect(api.widgets.preview).toHaveBeenCalled())
    const query = lastPreviewQuery()
    expect(query.group_by).toBe('week')
    expect(query.metrics).toHaveLength(1)
    expect(query.metrics[0]).toMatchObject({ agg: 'sum', field: 'volume' })
  })

  it('describes the query in plain language', async () => {
    renderEditor()
    expect(await screen.findByText('Total volume by week · last 90 days')).toBeInTheDocument()
  })

  it('re-runs the preview when the query changes', async () => {
    renderEditor()
    await waitFor(() => expect(api.widgets.preview).toHaveBeenCalled())

    fireEvent.change(await screen.findByLabelText('Group by'), { target: { value: 'exercise' } })

    await waitFor(() => expect(lastPreviewQuery().group_by).toBe('exercise'))
  })

  it('resolves the time range to a start date on the client', async () => {
    renderEditor()
    await waitFor(() => expect(api.widgets.preview).toHaveBeenCalled())

    // The server is never asked to work out what "the last 90 days" means.
    const [, range] = vi.mocked(api.widgets.preview).mock.calls[0]
    expect(range?.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    fireEvent.change(await screen.findByLabelText('Time range'), { target: { value: '' } })
    await waitFor(() => {
      const calls = vi.mocked(api.widgets.preview).mock.calls
      expect(calls[calls.length - 1][1]?.start).toBeNull()
    })
  })

  it('adds and removes metrics', async () => {
    renderEditor()
    await waitFor(() => expect(api.widgets.preview).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Add metric' }))
    await waitFor(() => expect(lastPreviewQuery().metrics).toHaveLength(2))
    // Keys are generated and unique — they are the row keys in the result.
    const keys = lastPreviewQuery().metrics.map((metric) => metric.key)
    expect(new Set(keys).size).toBe(2)

    fireEvent.click(screen.getAllByRole('button', { name: /^Remove / })[0])
    await waitFor(() => expect(lastPreviewQuery().metrics).toHaveLength(1))
  })

  it('swaps the field when the new aggregate cannot use the old one', async () => {
    renderEditor()
    await waitFor(() => expect(api.widgets.preview).toHaveBeenCalled())

    // "Count of sets" counts rows, so it must not carry a field along.
    fireEvent.change(screen.getByLabelText('Aggregate'), { target: { value: 'count' } })
    await waitFor(() => expect(lastPreviewQuery().metrics[0].field).toBeNull())
  })

  it('coerces a stranded filter value when the field changes', async () => {
    renderEditor()
    await waitFor(() => expect(api.widgets.preview).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Add filter' }))
    fireEvent.change(await screen.findByLabelText('Field'), { target: { value: 'category' } })
    fireEvent.change(screen.getByLabelText('Value'), { target: { value: 'legs' } })
    await waitFor(() => expect(lastPreviewQuery().filters[0]?.value).toBe('legs'))

    // Switching to a numeric field must not leave "legs" in a number filter.
    fireEvent.change(screen.getByLabelText('Field'), { target: { value: 'reps' } })
    await waitFor(() => expect(lastPreviewQuery().filters[0].value).toBe(0))
  })

  it('offers a picker rather than free text for exercises', async () => {
    renderEditor()
    await waitFor(() => expect(api.widgets.preview).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Add filter' }))
    fireEvent.change(await screen.findByLabelText('Field'), { target: { value: 'exercise_id' } })

    const value = await screen.findByLabelText('Value')
    expect(within(value).getByRole('option', { name: 'Back Squat' })).toBeInTheDocument()
  })

  it('will not save without a name', async () => {
    const { onSave } = renderEditor()
    await waitFor(() => expect(api.widgets.preview).toHaveBeenCalled())

    expect(screen.getByRole('button', { name: 'Create widget' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Widget name'), { target: { value: 'Weekly tonnage' } })

    const save = screen.getByRole('button', { name: 'Create widget' })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Weekly tonnage', visualization: 'bar' }),
    )
  })

  it('trims the name and drops an empty description', async () => {
    const { onSave } = renderEditor()
    await waitFor(() => expect(api.widgets.preview).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Widget name'), { target: { value: '  Tonnage  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create widget' }))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Tonnage', description: null }),
    )
  })

  it('shows the problem instead of running an invalid query', async () => {
    renderEditor()
    await waitFor(() => expect(api.widgets.preview).toHaveBeenCalled())
    const before = vi.mocked(api.widgets.preview).mock.calls.length

    fireEvent.click(screen.getAllByRole('button', { name: /^Remove / })[0])

    expect(await screen.findByText(/Add at least one metric/)).toBeInTheDocument()
    expect(vi.mocked(api.widgets.preview).mock.calls.length).toBe(before)
  })

  it('falls back to sorting by group when the sorted metric is removed', async () => {
    renderEditor()
    await waitFor(() => expect(api.widgets.preview).toHaveBeenCalled())

    fireEvent.click(screen.getByRole('button', { name: 'Add metric' }))
    await waitFor(() => expect(lastPreviewQuery().metrics).toHaveLength(2))

    const secondKey = lastPreviewQuery().metrics[1].key
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: secondKey } })
    await waitFor(() => expect(lastPreviewQuery().sort.by).toBe(secondKey))

    fireEvent.click(screen.getAllByRole('button', { name: /^Remove / })[1])
    await waitFor(() => expect(lastPreviewQuery().sort.by).toBe('group'))
  })

  it('hides ordering controls when there is only one row to show', async () => {
    renderEditor()
    await waitFor(() => expect(api.widgets.preview).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText('Group by'), { target: { value: 'none' } })
    await waitFor(() => expect(screen.queryByLabelText('Sort by')).not.toBeInTheDocument())
  })

  it('loads an existing widget into the form', async () => {
    renderEditor({
      widget: {
        id: 3,
        name: 'RPE drift',
        description: 'Average RPE per week',
        visualization: 'table',
        query: {
          source: 'sets',
          filters: [],
          group_by: 'week',
          metrics: [{ key: 'm1', agg: 'avg', field: 'reps', label: 'Avg reps' }],
          sort: { by: 'group', direction: 'asc' },
          limit: null,
          range_days: 30,
        },
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
      },
    })

    expect(await screen.findByLabelText('Widget name')).toHaveValue('RPE drift')
    expect(screen.getByLabelText('Visualization')).toHaveValue('table')
    expect(screen.getByLabelText('Aggregate')).toHaveValue('avg')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument()
  })
})
