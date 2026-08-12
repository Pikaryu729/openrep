import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
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
        reorder: vi.fn(),
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
  localStorage.clear()
})

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return {
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    queryClient,
  }
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

  it('renders weights in pounds when imperial units are selected', async () => {
    localStorage.setItem('openrep.units', 'imperial')
    mockHappyPath()

    renderWithClient(<WorkoutDetailPage workoutId={7} />)

    const table = await screen.findByRole('table')
    expect(within(table).getByText('Weight (lb)')).toBeInTheDocument()
    expect(within(table).getByText('220.5')).toBeInTheDocument()
    expect(within(table).getByText('308.6')).toBeInTheDocument()
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
    vi.mocked(api.sets.reorder).mockResolvedValue(sets)

    renderWithClient(<WorkoutDetailPage workoutId={7} />)
    const table = await screen.findByRole('table')

    const secondRow = within(table).getByText('Deadlift').closest('tr')!
    fireEvent.click(within(secondRow).getByRole('button', { name: 'Move set up' }))

    // One atomic request, so the rows never briefly share a set_order.
    await vi.waitFor(() =>
      expect(api.sets.reorder).toHaveBeenCalledWith([
        { id: 11, set_order: 1 },
        { id: 10, set_order: 2 },
      ]),
    )
  })

  it('surfaces a failed sets fetch instead of an empty state', async () => {
    // The bug this guards: `setsQuery.data ?? []` rendered "No sets yet",
    // i.e. a network blip looked like the user's logged sets had vanished.
    vi.mocked(api.workouts.get).mockResolvedValue(workout)
    vi.mocked(api.exercises.list).mockResolvedValue(exercises)
    vi.mocked(api.sets.listByWorkout).mockRejectedValue(new Error('network down'))

    renderWithClient(<WorkoutDetailPage workoutId={7} />)

    expect(await screen.findByText(/network down/)).toBeInTheDocument()
    expect(screen.queryByText('No sets yet')).not.toBeInTheDocument()
  })

  it('surfaces a failed exercises fetch instead of the empty-library prompt', async () => {
    vi.mocked(api.workouts.get).mockResolvedValue(workout)
    vi.mocked(api.sets.listByWorkout).mockResolvedValue(sets)
    vi.mocked(api.exercises.list).mockRejectedValue(new Error('network down'))

    renderWithClient(<WorkoutDetailPage workoutId={7} />)

    expect(await screen.findByText(/network down/)).toBeInTheDocument()
    expect(screen.queryByText('No exercises in your library')).not.toBeInTheDocument()
  })

  it('falls back to the first exercise when the selected one disappears', async () => {
    // The exercises list refetches on window focus; a <select> whose value
    // matches no option displays the first, so the stale id must not be POSTed.
    mockHappyPath()
    vi.mocked(api.sets.create).mockResolvedValue(sets[0])

    const { queryClient } = renderWithClient(<WorkoutDetailPage workoutId={7} />)
    await screen.findByRole('table')

    const form = screen.getByRole('heading', { name: 'Add set' }).closest('div')!
    fireEvent.change(within(form).getByLabelText('Exercise'), { target: { value: '2' } })

    // Deadlift (id 2) is deleted elsewhere and the shared ['exercises'] query
    // refetches without it — what refetchOnWindowFocus does in the real app.
    act(() => queryClient.setQueryData(['exercises'], [exercises[0]]))
    await vi.waitFor(() =>
      expect(within(form).getByLabelText('Exercise')).toHaveValue(String(exercises[0].id)),
    )

    fireEvent.change(within(form).getByLabelText('Weight (kg)'), { target: { value: '100' } })
    fireEvent.change(within(form).getByLabelText('Reps'), { target: { value: '5' } })
    fireEvent.click(within(form).getByRole('button', { name: 'Add set' }))

    await vi.waitFor(() =>
      expect(api.sets.create).toHaveBeenCalledWith(
        expect.objectContaining({ exercise_id: exercises[0].id }),
      ),
    )
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
