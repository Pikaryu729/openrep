import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, type CustomWidget, type QueryCatalog } from '../lib/api'
import { WidgetsIndex } from './widgets.index'

const navigate = vi.fn()

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    api: {
      widgets: { list: vi.fn(), catalog: vi.fn(), delete: vi.fn() },
    },
  }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigate,
    Link: ({
      to,
      params: _params,
      children,
      ...rest
    }: { to: string; params?: unknown; children?: React.ReactNode } & Record<string, unknown>) => (
      <a href={to} {...rest}>
        {children}
      </a>
    ),
  }
})

const CATALOG: QueryCatalog = {
  fields: [],
  group_by: [{ value: 'week', label: 'Week' }],
  aggregates: [{ value: 'sum', label: 'Total' }],
  visualizations: [{ value: 'bar', label: 'Bar chart' }],
  range_days: [30, 90, 365],
  rep_ranges: [],
  max_filters: 8,
  max_metrics: 4,
  max_rows: 500,
}

const widget = (id: number, name: string): CustomWidget => ({
  id,
  name,
  description: null,
  visualization: 'bar',
  query: {
    source: 'sets',
    filters: [],
    group_by: 'week',
    metrics: [{ key: 'm1', agg: 'sum', field: 'volume', label: 'Tonnage' }],
    sort: { by: 'group', direction: 'asc' },
    limit: null,
    range_days: 90,
  },
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
})

beforeEach(() => {
  vi.mocked(api.widgets.catalog).mockResolvedValue(CATALOG)
  vi.mocked(api.widgets.list).mockResolvedValue([])
})

afterEach(() => {
  vi.resetAllMocks()
  navigate.mockClear()
})

function renderPage(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('WidgetsIndex', () => {
  it('invites you to build one when you have none', async () => {
    renderPage(<WidgetsIndex />)
    expect(await screen.findByText("You haven't built any widgets yet")).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Create your first widget' }))
    expect(navigate).toHaveBeenCalledWith({ to: '/widgets/new' })
  })

  it('lists your widgets with a description of what each one asks', async () => {
    vi.mocked(api.widgets.list).mockResolvedValue([widget(1, 'Weekly tonnage')])
    renderPage(<WidgetsIndex />)

    expect(await screen.findByRole('heading', { name: 'Weekly tonnage' })).toBeInTheDocument()
    expect(await screen.findByText('Tonnage by week · last 90 days')).toBeInTheDocument()
  })

  it('confirms before deleting, and says what it costs', async () => {
    vi.mocked(api.widgets.list).mockResolvedValue([widget(1, 'Weekly tonnage')])
    vi.mocked(api.widgets.delete).mockResolvedValue(undefined)
    renderPage(<WidgetsIndex />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Weekly tonnage' }))

    const dialog = await screen.findByRole('dialog', { name: 'Delete "Weekly tonnage"?' })
    expect(dialog).toHaveTextContent('Your training data is untouched')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(api.widgets.delete).toHaveBeenCalledWith(1))
  })

  it('does not delete when the confirmation is dismissed', async () => {
    vi.mocked(api.widgets.list).mockResolvedValue([widget(1, 'Weekly tonnage')])
    renderPage(<WidgetsIndex />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Weekly tonnage' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete "Weekly tonnage"?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(api.widgets.delete).not.toHaveBeenCalled()
  })

  it('surfaces a failed load rather than showing an empty list', async () => {
    vi.mocked(api.widgets.list).mockRejectedValue(new Error('offline'))
    renderPage(<WidgetsIndex />)

    expect(await screen.findByText(/Could not load your widgets: offline/)).toBeInTheDocument()
  })
})
