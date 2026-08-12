import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { WorkoutsPage } from './workouts.index'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    api: {
      workouts: {
        list: vi.fn(),
        get: vi.fn(),
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

const workout = { id: 7, performed_on: '2026-08-01', notes: 'Leg day', created_at: '2026-08-01T10:00:00Z' }

describe('WorkoutsPage', () => {
  it('renders workouts as links to their detail page', async () => {
    vi.mocked(api.workouts.list).mockResolvedValue([workout])

    renderWithClient(<WorkoutsPage />)

    expect(await screen.findByText('2026-08-01')).toBeInTheDocument()
    expect(screen.getByText('Leg day')).toBeInTheDocument()
    expect(screen.getByText('2026-08-01').closest('a')).toHaveAttribute(
      'href',
      '/workouts/$workoutId',
    )
  })

  it('deletes a workout after confirmation', async () => {
    vi.mocked(api.workouts.list).mockResolvedValue([workout])
    vi.mocked(api.workouts.delete).mockResolvedValue(undefined)

    renderWithClient(<WorkoutsPage />)
    await screen.findByText('2026-08-01')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete workout on 2026-08-01?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await vi.waitFor(() => expect(api.workouts.delete).toHaveBeenCalledWith(7))
  })
})
