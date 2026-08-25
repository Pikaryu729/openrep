import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BottomNav } from './BottomNav'

// useIsMobile (src/hooks/use-mobile.ts) isn't exercised directly here — this
// component just renders NAV_ITEMS — but matchMedia still needs a stub
// because jsdom doesn't implement it and something in the render tree may
// touch it (e.g. via a shared provider in a future change).
function stubViewport() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

let currentPath = '/'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    Link: ({
      to,
      activeOptions,
      children,
      className,
    }: {
      to: string
      activeOptions?: { exact?: boolean }
      children?: ReactNode
      className?: string
    }) => {
      const isActive = activeOptions?.exact ? currentPath === to : currentPath.startsWith(to)
      return (
        <a href={to} className={className} data-status={isActive ? 'active' : undefined}>
          {children}
        </a>
      )
    },
  }
})

beforeEach(() => {
  stubViewport()
  currentPath = '/'
})

afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllGlobals()
})

describe('BottomNav', () => {
  it('renders all five nav links with correct hrefs and labels', () => {
    render(<BottomNav />)

    const expected = [
      ['Dashboard', '/'],
      ['Workouts', '/workouts'],
      ['Exercises', '/exercises'],
      ['Widgets', '/widgets'],
      ['Settings', '/settings'],
    ] as const

    for (const [label, href] of expected) {
      const link = screen.getByRole('link', { name: label })
      expect(link).toHaveAttribute('href', href)
    }
  })

  it('marks the link matching the current route as active', () => {
    currentPath = '/workouts'
    render(<BottomNav />)

    expect(screen.getByRole('link', { name: 'Workouts' }).getAttribute('data-status')).toBe(
      'active',
    )
    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('data-status')).toBeNull()
    expect(screen.getByRole('link', { name: 'Exercises' }).getAttribute('data-status')).toBeNull()
  })

  it('does not mark Dashboard active on other routes (exact match)', () => {
    currentPath = '/exercises'
    render(<BottomNav />)

    expect(screen.getByRole('link', { name: 'Dashboard' }).getAttribute('data-status')).toBeNull()
    expect(screen.getByRole('link', { name: 'Exercises' }).getAttribute('data-status')).toBe(
      'active',
    )
  })
})
