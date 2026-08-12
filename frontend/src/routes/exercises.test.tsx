import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../lib/api'
import { ExercisesPage } from './exercises'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    api: {
      exercises: {
        list: vi.fn(),
        get: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    },
  }
})

afterEach(() => {
  vi.resetAllMocks()
})

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('ExercisesPage', () => {
  it('renders exercises returned by the API', async () => {
    vi.mocked(api.exercises.list).mockResolvedValue([
      { id: 1, name: 'Deadlift', category: 'back', notes: null },
    ])

    renderWithClient(<ExercisesPage />)

    expect(await screen.findByText('Deadlift')).toBeInTheDocument()
  })

  it('edits an exercise through the modal', async () => {
    vi.mocked(api.exercises.list).mockResolvedValue([
      { id: 1, name: 'Deadlift', category: 'back', notes: null },
    ])
    vi.mocked(api.exercises.update).mockResolvedValue({
      id: 1,
      name: 'Romanian Deadlift',
      category: 'back',
      notes: null,
    })

    renderWithClient(<ExercisesPage />)
    await screen.findByText('Deadlift')

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const dialog = await screen.findByRole('dialog', { name: 'Edit exercise' })
    const nameInput = dialog.querySelector('input')!
    fireEvent.change(nameInput, { target: { value: 'Romanian Deadlift' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() =>
      expect(api.exercises.update).toHaveBeenCalledWith(1, {
        name: 'Romanian Deadlift',
        category: 'back',
        notes: null,
      }),
    )
  })

  it('deletes an exercise after confirmation', async () => {
    vi.mocked(api.exercises.list).mockResolvedValue([
      { id: 1, name: 'Deadlift', category: 'back', notes: null },
    ])
    vi.mocked(api.exercises.delete).mockResolvedValue(undefined)

    renderWithClient(<ExercisesPage />)
    await screen.findByText('Deadlift')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete Deadlift?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await vi.waitFor(() => expect(api.exercises.delete).toHaveBeenCalledWith(1))
  })

  it('shows a duplicate-name message on 409', async () => {
    vi.mocked(api.exercises.list).mockResolvedValue([])
    vi.mocked(api.exercises.create).mockRejectedValue(new ApiError(409, 'conflict'))

    renderWithClient(<ExercisesPage />)

    fireEvent.change(screen.getByPlaceholderText('Exercise name'), {
      target: { value: 'Deadlift' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(
      await screen.findByText('An exercise with this name already exists.'),
    ).toBeInTheDocument()
  })
})
