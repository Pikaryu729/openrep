import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../lib/api'
import { ExerciseDetailPage } from './exercises.$exerciseId'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    api: {
      exercises: { get: vi.fn() },
      analytics: {
        exerciseHistory: vi.fn(),
        exercisePersonalRecords: vi.fn(),
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

const exercise = { id: 1, name: 'Back Squat', category: 'legs', notes: null }
const records = {
  exercise_id: 1,
  max_weight_kg: 110,
  max_weight_achieved_on: '2026-08-08',
  max_estimated_1rm_kg: 116.67,
  max_estimated_1rm_achieved_on: '2026-08-01',
  max_volume_in_a_workout_kg: 610,
  max_volume_achieved_on: '2026-08-01',
}
const history = [
  { performed_on: '2026-08-01', weight_kg: 100, reps: 5, rpe: 8, estimated_1rm_kg: 116.67 },
  { performed_on: '2026-08-08', weight_kg: 110, reps: 3, rpe: null, estimated_1rm_kg: 121 },
]

describe('ExerciseDetailPage', () => {
  it('shows personal records with the date each was set', async () => {
    vi.mocked(api.exercises.get).mockResolvedValue(exercise)
    vi.mocked(api.analytics.exercisePersonalRecords).mockResolvedValue(records)
    vi.mocked(api.analytics.exerciseHistory).mockResolvedValue(history)

    renderWithClient(<ExerciseDetailPage exerciseId={1} />)

    expect(await screen.findByText('Heaviest set')).toBeInTheDocument()
    expect(screen.getByText('Heaviest set').parentElement).toHaveTextContent('110')
    expect(screen.getByText('Best est. 1RM').parentElement).toHaveTextContent('116.67')
    // A PR is dated to the first day it was reached, and shown as such.
    expect(screen.getByText('Best est. 1RM').parentElement).toHaveTextContent('2026')
  })

  it('converts records to the display unit', async () => {
    localStorage.setItem('openrep.units', 'imperial')
    vi.mocked(api.exercises.get).mockResolvedValue(exercise)
    vi.mocked(api.analytics.exercisePersonalRecords).mockResolvedValue(records)
    vi.mocked(api.analytics.exerciseHistory).mockResolvedValue(history)

    renderWithClient(<ExerciseDetailPage exerciseId={1} />)

    expect(await screen.findByText('Heaviest set')).toBeInTheDocument()
    expect(screen.getByText('Heaviest set').parentElement).toHaveTextContent('242.5')
    expect(screen.getByText('Heaviest set').parentElement).toHaveTextContent('lb')
  })

  it('renders an em dash for an exercise with no records yet', async () => {
    vi.mocked(api.exercises.get).mockResolvedValue(exercise)
    vi.mocked(api.analytics.exercisePersonalRecords).mockResolvedValue({
      exercise_id: 1,
      max_weight_kg: null,
      max_weight_achieved_on: null,
      max_estimated_1rm_kg: null,
      max_estimated_1rm_achieved_on: null,
      max_volume_in_a_workout_kg: null,
      max_volume_achieved_on: null,
    })
    vi.mocked(api.analytics.exerciseHistory).mockResolvedValue([])

    renderWithClient(<ExerciseDetailPage exerciseId={1} />)

    expect(await screen.findByText('No sets logged for this exercise')).toBeInTheDocument()
    expect(screen.getByText('Heaviest set').parentElement).toHaveTextContent('—')
  })

  it('reports a deleted exercise instead of an empty chart', async () => {
    vi.mocked(api.exercises.get).mockRejectedValue(new ApiError(404, 'Not Found'))
    vi.mocked(api.analytics.exercisePersonalRecords).mockResolvedValue(records)
    vi.mocked(api.analytics.exerciseHistory).mockResolvedValue(history)

    renderWithClient(<ExerciseDetailPage exerciseId={1} />)

    expect(await screen.findByText('Exercise not found')).toBeInTheDocument()
  })

  it('surfaces a failed analytics fetch rather than charting nothing', async () => {
    vi.mocked(api.exercises.get).mockResolvedValue(exercise)
    vi.mocked(api.analytics.exercisePersonalRecords).mockResolvedValue(records)
    vi.mocked(api.analytics.exerciseHistory).mockRejectedValue(new Error('network down'))

    renderWithClient(<ExerciseDetailPage exerciseId={1} />)

    expect(await screen.findByText(/network down/)).toBeInTheDocument()
    expect(screen.queryByText('No sets logged for this exercise')).not.toBeInTheDocument()
  })
})
