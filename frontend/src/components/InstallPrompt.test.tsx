import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InstallPrompt } from './InstallPrompt'

function stubMatchMedia(standalone: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)' && standalone,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

const originalUserAgent = window.navigator.userAgent

function stubUserAgent(userAgent: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: userAgent,
    configurable: true,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  Object.defineProperty(window.navigator, 'userAgent', {
    value: originalUserAgent,
    configurable: true,
  })
  delete (window.navigator as unknown as { standalone?: boolean }).standalone
})

describe('InstallPrompt', () => {
  it('renders nothing when already installed (standalone display mode)', () => {
    stubMatchMedia(true)
    stubUserAgent(
      'Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
    )

    const { container } = render(<InstallPrompt />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the native install button and triggers prompt() on click', () => {
    stubMatchMedia(false)
    stubUserAgent(
      'Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile',
    )

    render(<InstallPrompt />)

    const prompt = vi.fn().mockResolvedValue(undefined)
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
      prompt: () => Promise<void>
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
    }
    event.prompt = prompt
    event.userChoice = Promise.resolve({ outcome: 'accepted' })
    fireEvent(window, event)

    const button = screen.getByRole('button', { name: 'Install' })
    fireEvent.click(button)

    expect(prompt).toHaveBeenCalledTimes(1)
  })

  it('renders iOS instructions when the UA matches iOS and not standalone', () => {
    stubMatchMedia(false)
    stubUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
    )

    render(<InstallPrompt />)

    expect(screen.getByText('Install OpenRep')).toBeInTheDocument()
    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument()
    expect(screen.getByText(/Tap the Share icon/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Install' })).not.toBeInTheDocument()
  })

  it('renders nothing on a platform with no install affordance (e.g. desktop Firefox)', () => {
    stubMatchMedia(false)
    stubUserAgent(
      'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
    )

    const { container } = render(<InstallPrompt />)

    expect(container).toBeEmptyDOMElement()
  })
})
