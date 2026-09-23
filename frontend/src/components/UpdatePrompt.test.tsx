import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UpdatePrompt } from './UpdatePrompt'

const { useRegisterSW } = vi.hoisted(() => ({ useRegisterSW: vi.fn() }))

vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW }))

afterEach(() => {
  vi.resetAllMocks()
})

describe('UpdatePrompt', () => {
  it('renders nothing when needRefresh is false', () => {
    useRegisterSW.mockReturnValue({
      needRefresh: [false, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    })

    const { container } = render(<UpdatePrompt />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the update banner when needRefresh is true', () => {
    useRegisterSW.mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: vi.fn(),
    })

    render(<UpdatePrompt />)

    expect(screen.getByText('Update available')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
  })

  it('calls updateServiceWorker(true) when Reload is clicked', () => {
    const updateServiceWorker = vi.fn()
    useRegisterSW.mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker,
    })

    render(<UpdatePrompt />)
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))

    expect(updateServiceWorker).toHaveBeenCalledWith(true)
  })
})
