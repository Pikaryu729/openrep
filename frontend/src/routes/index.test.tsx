import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { Dashboard } from './index'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    api: {
      analytics: {
        volumeByDay: vi.fn(),
        recentPersonalRecords: vi.fn(),
      },
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

afterEach(() => {
  vi.resetAllMocks()
  localStorage.clear()
})

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

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
  {
    exercise_id: 1,
    exercise_name: 'Back Squat',
    max_estimated_1rm_kg: 116.67,
    achieved_on: '2026-08-01',
  },
]

describe('Dashboard', () => {
  it('summarises sessions, sets, and total volume', async () => {
    vi.mocked(api.analytics.volumeByDay).mockResolvedValue(volume)
    vi.mocked(api.analytics.recentPersonalRecords).mockResolvedValue([])

    renderWithClient(<Dashboard />)

    expect(await screen.findByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('Sessions').parentElement).toHaveTextContent('2')
    expect(screen.getByText('Sets logged').parentElement).toHaveTextContent('10')
    // 1000 + 1500 kg, compacted.
    expect(screen.getByText('Total volume').parentElement).toHaveTextContent('2.5K')
  })

  it('lists personal records linking to their exercise', async () => {
    vi.mocked(api.analytics.volumeByDay).mockResolvedValue(volume)
    vi.mocked(api.analytics.recentPersonalRecords).mockResolvedValue(records)

    renderWithClient(<Dashboard />)

    const press = await screen.findByText('Overhead Press')
    expect(press.closest('a')).toHaveAttribute('href', '/exercises/$exerciseId')
    expect(screen.getByText('Back Squat')).toBeInTheDocument()
  })

  it('renders volume in pounds when imperial units are selected', async () => {
    localStorage.setItem('openrep.units', 'imperial')
    vi.mocked(api.analytics.volumeByDay).mockResolvedValue(volume)
    vi.mocked(api.analytics.recentPersonalRecords).mockResolvedValue([])

    renderWithClient(<Dashboard />)

    expect(await screen.findByText('Total volume')).toBeInTheDocument()
    expect(screen.getByText('Total volume').parentElement).toHaveTextContent('lb')
  })

  it('shows an empty state before any workout is logged', async () => {
    vi.mocked(api.analytics.volumeByDay).mockResolvedValue([])
    vi.mocked(api.analytics.recentPersonalRecords).mockResolvedValue([])

    renderWithClient(<Dashboard />)

    expect(await screen.findByText('No workouts logged yet')).toBeInTheDocument()
  })

  it('surfaces a volume failure', async () => {
    vi.mocked(api.analytics.volumeByDay).mockRejectedValue(new Error('network down'))
    vi.mocked(api.analytics.recentPersonalRecords).mockResolvedValue([])

    renderWithClient(<Dashboard />)

    expect(await screen.findByText(/network down/)).toBeInTheDocument()
  })

  it('keeps the page usable when only the records panel fails', async () => {
    vi.mocked(api.analytics.volumeByDay).mockResolvedValue(volume)
    vi.mocked(api.analytics.recentPersonalRecords).mockRejectedValue(new Error('records down'))

    renderWithClient(<Dashboard />)

    // The volume summary still renders; only the panel reports the error.
    expect(await screen.findByText(/records down/)).toBeInTheDocument()
    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('Sessions').parentElement).toHaveTextContent('2')
  })
})
