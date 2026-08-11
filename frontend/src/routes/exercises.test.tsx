import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { ExercisesPage } from './exercises'

vi.mock('../lib/api', () => ({
  api: {
    exercises: {
      list: vi.fn(),
      create: vi.fn(),
    },
  },
}))

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
})
