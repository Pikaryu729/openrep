import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { Dashboard } from './index'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    api: {
      dashboard: { getConfig: vi.fn(), saveConfig: vi.fn() },
      exercises: { list: vi.fn() },
      analytics: {
        volumeByDay: vi.fn(),
        volumeByCategory: vi.fn(),
        recentPersonalRecords: vi.fn(),
        exerciseHistory: vi.fn(),
      },
      workouts: { list: vi.fn() },
    },
  }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
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

const volume = [
  { performed_on: '2026-08-01', total_volume_kg: 1000, total_sets: 4 },
  { performed_on: '2026-08-08', total_volume_kg: 1500, total_sets: 6 },
]
const records = [
  {
    exercise_id: 2,
    exercise_name: 'Overhead Press',
    max_estimated_1rm_kg: 66,
    achieved_on: '2026-08-09',
  },
]
const exercises = [
  { id: 1, name: 'Back Squat', category: 'legs', notes: null },
  { id: 2, name: 'Overhead Press', category: 'shoulders', notes: null },
]

const DEFAULT_CONFIG = {
  version: 1,
  updated_at: null,
  widgets: [
    { id: 'stats', type: 'stat_tiles', options: {} },
    { id: 'volume', type: 'volume_chart', options: { range_days: null } },
    { id: 'records', type: 'personal_records', options: { limit: 5 } },
  ],
}

beforeEach(() => {
  vi.mocked(api.dashboard.getConfig).mockResolvedValue(DEFAULT_CONFIG)
  vi.mocked(api.exercises.list).mockResolvedValue(exercises)
  vi.mocked(api.analytics.volumeByDay).mockResolvedValue(volume)
  vi.mocked(api.analytics.recentPersonalRecords).mockResolvedValue(records)
  vi.mocked(api.analytics.volumeByCategory).mockResolvedValue([])
  vi.mocked(api.workouts.list).mockResolvedValue([])
})

afterEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
})

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

async function enterEditMode() {
  fireEvent.click(await screen.findByRole('button', { name: 'Edit dashboard' }))
}

/**
 * Widget titles in render order. Only meaningful in edit mode: the stat tiles
 * deliberately render bare in view mode, so the default dashboard looks exactly
 * as it did before widgets existed.
 */
function widgetTitles() {
  return screen
    .getAllByRole('heading')
    .map((heading) => heading.textContent)
    .filter((text) => text !== 'Dashboard')
}

describe('Dashboard rendering', () => {
  it('renders the stored layout in order', async () => {
    renderWithClient(<Dashboard />)

    expect(await screen.findByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('Sessions').parentElement).toHaveTextContent('2')
    expect(screen.getByText('Sets logged').parentElement).toHaveTextContent('10')
    expect(screen.getByText('Total volume').parentElement).toHaveTextContent('2.5K')
    expect(screen.getByText('Overhead Press')).toBeInTheDocument()
  })

  it('drops widget types it does not know while keeping the rest', async () => {
    vi.mocked(api.dashboard.getConfig).mockResolvedValue({
      version: 1,
      updated_at: '2026-08-10T00:00:00Z',
      widgets: [
        { id: 'a', type: 'hologram', options: {} },
        { id: 'b', type: 'personal_records', options: { limit: 5 } },
      ],
    })

    renderWithClient(<Dashboard />)

    expect(await screen.findByText('Overhead Press')).toBeInTheDocument()
    expect(screen.getByText(/from a newer version of OpenRep/)).toBeInTheDocument()
  })

  it('renders volume in pounds when imperial units are selected', async () => {
    localStorage.setItem('openrep.units', 'imperial')
    renderWithClient(<Dashboard />)

    expect(await screen.findByText('Total volume')).toBeInTheDocument()
    expect(screen.getByText('Total volume').parentElement).toHaveTextContent('lb')
  })

  it('shows an empty-layout state with a way back in', async () => {
    vi.mocked(api.dashboard.getConfig).mockResolvedValue({
      version: 1,
      updated_at: '2026-08-10T00:00:00Z',
      widgets: [],
    })

    renderWithClient(<Dashboard />)

    expect(await screen.findByText('Your dashboard is empty')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add widgets' }))
    expect(await screen.findByRole('dialog', { name: 'Add widget' })).toBeInTheDocument()
  })

  it('surfaces a config failure', async () => {
    vi.mocked(api.dashboard.getConfig).mockRejectedValue(new Error('config down'))
    renderWithClient(<Dashboard />)
    expect(await screen.findByText(/config down/)).toBeInTheDocument()
  })

  it('contains a failing widget query to that widget', async () => {
    vi.mocked(api.analytics.volumeByDay).mockRejectedValue(new Error('volume down'))
    renderWithClient(<Dashboard />)

    // The records widget still renders; only the volume-backed ones report.
    expect(await screen.findByText('Overhead Press')).toBeInTheDocument()
    expect(screen.getAllByText(/volume down/).length).toBeGreaterThan(0)
  })
})

describe('Dashboard edit mode', () => {
  it('adds a widget from the catalog', async () => {
    renderWithClient(<Dashboard />)
    await enterEditMode()

    fireEvent.click(screen.getByRole('button', { name: 'Add widget' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add widget' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Volume by category' }))

    expect(widgetTitles()).toContain('Volume by category')
  })

  it('reorders widgets with the arrow buttons', async () => {
    renderWithClient(<Dashboard />)
    await enterEditMode()

    const before = widgetTitles()
    fireEvent.click(screen.getAllByRole('button', { name: 'Move widget down' })[0])

    const after = widgetTitles()
    expect(after[0]).toBe(before[1])
    expect(after[1]).toBe(before[0])
  })

  it('disables reordering at the ends', async () => {
    renderWithClient(<Dashboard />)
    await enterEditMode()

    const up = screen.getAllByRole('button', { name: 'Move widget up' })
    const down = screen.getAllByRole('button', { name: 'Move widget down' })
    expect(up[0]).toBeDisabled()
    expect(down[down.length - 1]).toBeDisabled()
  })

  it('removes a widget without a confirmation, since Cancel is the undo', async () => {
    renderWithClient(<Dashboard />)
    await enterEditMode()

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' })
    expect(widgetTitles()).toHaveLength(removeButtons.length)
    fireEvent.click(removeButtons[0])

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(widgetTitles()).toHaveLength(removeButtons.length - 1)
  })

  it('saves the exact widget array and leaves edit mode', async () => {
    vi.mocked(api.dashboard.saveConfig).mockResolvedValue({
      ...DEFAULT_CONFIG,
      updated_at: '2026-08-12T00:00:00Z',
      widgets: DEFAULT_CONFIG.widgets.slice(0, 2),
    })

    renderWithClient(<Dashboard />)
    await enterEditMode()
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[2])
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() =>
      expect(api.dashboard.saveConfig).toHaveBeenCalledWith({
        version: 1,
        widgets: [
          { id: 'stats', type: 'stat_tiles', options: { metrics: ['sessions', 'sets', 'volume', 'last_session'] } },
          { id: 'volume', type: 'volume_chart', options: { range_days: null } },
        ],
      }),
    )
    await screen.findByRole('button', { name: 'Edit dashboard' })
  })

  it('keeps Save disabled until something changes', async () => {
    renderWithClient(<Dashboard />)
    await enterEditMode()

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })

  it('keeps the draft when saving fails', async () => {
    vi.mocked(api.dashboard.saveConfig).mockRejectedValue(new Error('save failed'))

    renderWithClient(<Dashboard />)
    await enterEditMode()
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    const remaining = widgetTitles()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText(/save failed/)).toBeInTheDocument()
    // Still editing, still holding the user's edit.
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(widgetTitles()).toEqual(remaining)
  })

  it('confirms before discarding changes, and restores the saved layout', async () => {
    renderWithClient(<Dashboard />)
    await enterEditMode()
    const original = widgetTitles()

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0])
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    const dialog = await screen.findByRole('dialog', { name: 'Discard dashboard changes?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))

    expect(await screen.findByRole('button', { name: 'Edit dashboard' })).toBeInTheDocument()
    // Compared from inside edit mode, since view mode renders no stat-tile heading.
    await enterEditMode()
    expect(widgetTitles()).toEqual(original)
  })

  it('leaves edit mode without confirming when nothing changed', async () => {
    renderWithClient(<Dashboard />)
    await enterEditMode()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Edit dashboard' })).toBeInTheDocument()
  })
})

describe('Dashboard layout import', () => {
  function layoutFile(widgets: unknown[], name = 'layout.json') {
    return new File(
      [JSON.stringify({ app: 'openrep', kind: 'dashboard', version: 1, exported_at: 'x', widgets })],
      name,
      { type: 'application/json' },
    )
  }

  it('imports into the draft without saving', async () => {
    renderWithClient(<Dashboard />)
    await enterEditMode()

    fireEvent.change(screen.getByLabelText('Dashboard layout file'), {
      target: {
        files: [layoutFile([{ id: 'x', type: 'category_breakdown', options: { range_days: 90 } }])],
      },
    })

    const dialog = await screen.findByRole('dialog', { name: 'Replace your dashboard layout?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace layout' }))

    expect(widgetTitles()).toEqual(['Volume by category'])
    // The whole point of the explicit-save contract.
    expect(api.dashboard.saveConfig).not.toHaveBeenCalled()
  })

  it('names exercises it cannot resolve', async () => {
    renderWithClient(<Dashboard />)
    await enterEditMode()

    fireEvent.change(screen.getByLabelText('Dashboard layout file'), {
      target: {
        files: [
          layoutFile([
            { id: 'x', type: 'exercise_progress', options: { exercise_name: 'Zercher Squat' } },
          ]),
        ],
      },
    })

    const dialog = await screen.findByRole('dialog', { name: 'Replace your dashboard layout?' })
    expect(within(dialog).getByText(/Zercher Squat/)).toBeInTheDocument()
  })

  it('rejects a file that is not an OpenRep layout', async () => {
    renderWithClient(<Dashboard />)
    await enterEditMode()

    fireEvent.change(screen.getByLabelText('Dashboard layout file'), {
      target: {
        files: [
          new File([JSON.stringify({ app: 'openrep', kind: 'backup', version: 1 })], 'backup.json', {
            type: 'application/json',
          }),
        ],
      },
    })

    expect(
      await screen.findByText('This file is not an OpenRep v1 dashboard layout.'),
    ).toBeInTheDocument()
  })
})
