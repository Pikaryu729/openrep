import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startInstallPromptCapture } from '@/lib/installPrompt'
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

const originalMaxTouchPoints = window.navigator.maxTouchPoints

function stubMaxTouchPoints(maxTouchPoints: number) {
  Object.defineProperty(window.navigator, 'maxTouchPoints', {
    value: maxTouchPoints,
    configurable: true,
  })
}

const ANDROID_UA =
  'Mozilla/5.0 (Linux; Android 10; Pixel 4) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile'
// iPadOS 13+ requests desktop sites by default, so an iPad and a real Mac send
// exactly this same UA — only maxTouchPoints tells them apart.
const MAC_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15'

type BeforeInstallPromptTestEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function makeBeforeInstallPromptEvent(
  prompt: () => Promise<void> = vi.fn().mockResolvedValue(undefined),
): BeforeInstallPromptTestEvent {
  const event = new Event('beforeinstallprompt', {
    cancelable: true,
  }) as BeforeInstallPromptTestEvent
  event.prompt = prompt
  event.userChoice = Promise.resolve({ outcome: 'accepted' })
  return event
}

// Mirrors main.tsx: the app shell starts capture before any route renders.
let stopCapture: () => void

beforeEach(() => {
  stopCapture = startInstallPromptCapture()
})

afterEach(() => {
  // Also resets the captured event, so one test's prompt never leaks into the
  // next through the module-level store.
  stopCapture()
  vi.unstubAllGlobals()
  Object.defineProperty(window.navigator, 'userAgent', {
    value: originalUserAgent,
    configurable: true,
  })
  stubMaxTouchPoints(originalMaxTouchPoints)
  delete (window.navigator as unknown as { standalone?: boolean }).standalone
})

describe('InstallPrompt', () => {
  it('renders nothing when already installed (standalone display mode)', () => {
    stubMatchMedia(true)
    stubUserAgent(ANDROID_UA)

    const { container } = render(<InstallPrompt />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the native install button and triggers prompt() on click', () => {
    stubMatchMedia(false)
    stubUserAgent(ANDROID_UA)

    render(<InstallPrompt />)

    const prompt = vi.fn().mockResolvedValue(undefined)
    fireEvent(window, makeBeforeInstallPromptEvent(prompt))

    const button = screen.getByRole('button', { name: 'Install' })
    fireEvent.click(button)

    expect(prompt).toHaveBeenCalledTimes(1)
  })

  // Regression: Chrome fires `beforeinstallprompt` shortly after load, long
  // before the user is likely to open Settings. When the listener lived in the
  // card's own effect the event was dropped for the whole SPA session, so the
  // Android/Chrome install path silently disappeared until a full reload with
  // Settings already open.
  it('offers the native install when beforeinstallprompt fired before the card mounted', () => {
    stubMatchMedia(false)
    stubUserAgent(ANDROID_UA)

    const prompt = vi.fn().mockResolvedValue(undefined)
    // The app shell is running, but the user is on some other route — nothing
    // from the Settings card is mounted yet.
    fireEvent(window, makeBeforeInstallPromptEvent(prompt))

    // Now they navigate to Settings.
    render(<InstallPrompt />)

    fireEvent.click(screen.getByRole('button', { name: 'Install' }))

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

  // iPadOS 13+ reports a desktop-class Mac UA, so matching only /iPad|iPhone|
  // iPod/ left every modern iPad with no install instructions at all.
  it('renders iOS instructions on iPadOS, which reports a desktop Mac UA', () => {
    stubMatchMedia(false)
    stubUserAgent(MAC_UA)
    stubMaxTouchPoints(5)

    render(<InstallPrompt />)

    expect(screen.getByText('Add to Home Screen')).toBeInTheDocument()
    expect(screen.getByText(/Tap the Share icon/)).toBeInTheDocument()
  })

  it('renders nothing on a real Mac, which sends the same UA but reports no touch points', () => {
    stubMatchMedia(false)
    stubUserAgent(MAC_UA)
    stubMaxTouchPoints(0)

    const { container } = render(<InstallPrompt />)

    expect(container).toBeEmptyDOMElement()
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
