import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { WorkoutDetailPage } from './workouts.$workoutId'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    api: {
      exercises: { list: vi.fn() },
      workouts: { get: vi.fn(), update: vi.fn(), delete: vi.fn() },
      sets: {
        listByWorkout: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
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
    useNavigate: () => vi.fn(),
  }
})

afterEach(() => {
  vi.resetAllMocks()
})

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

const workout = { id: 7, performed_on: '2026-08-01', notes: null, created_at: '2026-08-01T10:00:00Z' }
const exercises = [
  { id: 1, name: 'Back Squat', category: 'legs', notes: null },
  { id: 2, name: 'Deadlift', category: 'back', notes: null },
]
const sets = [
  { id: 10, workout_id: 7, exercise_id: 1, weight_kg: 100, reps: 5, rpe: 8, set_order: 1 },
  { id: 11, workout_id: 7, exercise_id: 2, weight_kg: 140, reps: 3, rpe: null, set_order: 2 },
]

function mockHappyPath() {
  vi.mocked(api.workouts.get).mockResolvedValue(workout)
  vi.mocked(api.exercises.list).mockResolvedValue(exercises)
  vi.mocked(api.sets.listByWorkout).mockResolvedValue(sets)
}

describe('WorkoutDetailPage', () => {
  it('renders sets with resolved exercise names', async () => {
    mockHappyPath()

    renderWithClient(<WorkoutDetailPage workoutId={7} />)

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Back Squat')).toBeInTheDocument()
    expect(within(table).getByText('Deadlift')).toBeInTheDocument()
    expect(within(table).getByText('140')).toBeInTheDocument()
  })

  it('adds a set with the next set_order', async () => {
    mockHappyPath()
    vi.mocked(api.sets.create).mockResolvedValue({
      id: 12,
      workout_id: 7,
      exercise_id: 1,
      weight_kg: 102.5,
      reps: 5,
      rpe: null,
      set_order: 3,
    })

    renderWithClient(<WorkoutDetailPage workoutId={7} />)
    await screen.findByRole('table')

    const form = screen.getByRole('heading', { name: 'Add set' }).closest('div')!
    fireEvent.change(within(form).getByLabelText('Weight (kg)'), { target: { value: '102.5' } })
    fireEvent.change(within(form).getByLabelText('Reps'), { target: { value: '5' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add set' }))

    await vi.waitFor(() =>
      expect(api.sets.create).toHaveBeenCalledWith({
        workout_id: 7,
        exercise_id: 1,
        weight_kg: 102.5,
        reps: 5,
        rpe: undefined,
        set_order: 3,
      }),
    )
  })

  it('deletes a set after confirmation', async () => {
    mockHappyPath()
    vi.mocked(api.sets.delete).mockResolvedValue(undefined)

    renderWithClient(<WorkoutDetailPage workoutId={7} />)
    const table = await screen.findByRole('table')

    const firstRow = within(table).getByText('Back Squat').closest('tr')!
    fireEvent.click(within(firstRow).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete set?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await vi.waitFor(() => expect(api.sets.delete).toHaveBeenCalledWith(10))
  })

  it('reorders sets by swapping set_order with the adjacent row', async () => {
    mockHappyPath()
    vi.mocked(api.sets.update).mockResolvedValue(sets[0])

    renderWithClient(<WorkoutDetailPage workoutId={7} />)
    const table = await screen.findByRole('table')

    const secondRow = within(table).getByText('Deadlift').closest('tr')!
    fireEvent.click(within(secondRow).getByRole('button', { name: 'Move set up' }))

    await vi.waitFor(() => {
      expect(api.sets.update).toHaveBeenCalledWith(11, { set_order: 1 })
      expect(api.sets.update).toHaveBeenCalledWith(10, { set_order: 2 })
    })
  })

  it('disables reorder at the boundaries', async () => {
    mockHappyPath()

    renderWithClient(<WorkoutDetailPage workoutId={7} />)
    const table = await screen.findByRole('table')

    const firstRow = within(table).getByText('Back Squat').closest('tr')!
    const lastRow = within(table).getByText('Deadlift').closest('tr')!
    expect(within(firstRow).getByRole('button', { name: 'Move set up' })).toBeDisabled()
    expect(within(lastRow).getByRole('button', { name: 'Move set down' })).toBeDisabled()
  })
})
