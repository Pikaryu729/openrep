import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../lib/api'
import { THEME_STORAGE_KEY } from '../lib/theme'
import { SettingsPage } from './settings'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>()
  return {
    ...actual,
    api: {
      backup: {
        exportData: vi.fn(),
        importData: vi.fn(),
      },
    },
  }
})

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetAllMocks()
  localStorage.clear()
  document.documentElement.removeAttribute('data-mode')
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.style.removeProperty('--accent')
  document.documentElement.style.removeProperty('--accent-contrast')
})

function renderWithClient(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('SettingsPage appearance', () => {
  it('persists mode changes and applies them to the document', () => {
    renderWithClient(<SettingsPage />)

    fireEvent.click(screen.getByTestId('mode-dark'))

    expect(document.documentElement.dataset.mode).toBe('dark')
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY)!).mode).toBe('dark')
  })

  it('applies preset selections', () => {
    renderWithClient(<SettingsPage />)

    fireEvent.click(screen.getByTestId('preset-ocean'))

    expect(document.documentElement.dataset.theme).toBe('ocean')
    expect(JSON.parse(localStorage.getItem(THEME_STORAGE_KEY)!).preset).toBe('ocean')
  })

  it('applies a custom accent and can reset it', () => {
    renderWithClient(<SettingsPage />)

    fireEvent.change(screen.getByLabelText('Custom accent color'), {
      target: { value: '#123456' },
    })
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#123456')

    fireEvent.click(screen.getByRole('button', { name: 'Reset to preset accent' }))
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('')
  })
})

describe('SettingsPage units', () => {
  it('persists the units preference', () => {
    renderWithClient(<SettingsPage />)

    expect(screen.getByTestId('unit-metric')).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByTestId('unit-imperial'))

    expect(localStorage.getItem('openrep.units')).toBe('imperial')
    expect(screen.getByTestId('unit-imperial')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('unit-metric')).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('SettingsPage backup', () => {
  it('imports a chosen backup file with the selected mode', async () => {
    const document_ = {
      app: 'openrep',
      version: 1,
      exported_at: '2026-08-10T00:00:00Z',
      exercises: [],
      workouts: [],
      sets: [],
    }
    vi.mocked(api.backup.importData).mockResolvedValue({
      mode: 'merge',
      exercises_created: 0,
      exercises_matched: 0,
      workouts_created: 0,
      sets_created: 0,
    })

    renderWithClient(<SettingsPage />)

    const file = new File([JSON.stringify(document_)], 'backup.json', {
      type: 'application/json',
    })
    fireEvent.change(screen.getByLabelText('Backup file'), { target: { files: [file] } })

    const dialog = await screen.findByRole('dialog', { name: 'Merge backup?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Import' }))

    await vi.waitFor(() =>
      expect(api.backup.importData).toHaveBeenCalledWith({ mode: 'merge', data: document_ }),
    )
    expect(await screen.findByText(/Imported \(merge\)/)).toBeInTheDocument()
  })

  it('lets the same file be imported again after a successful import', async () => {
    // Realising you meant "replace" right after importing as "merge" means
    // picking the same file twice. A file input whose value still holds that
    // filename fires no second change event, so the input is cleared as soon
    // as the contents have been read.
    const document_ = {
      app: 'openrep',
      version: 1,
      exported_at: '2026-08-10T00:00:00Z',
      exercises: [],
      workouts: [],
      sets: [],
    }
    vi.mocked(api.backup.importData).mockResolvedValue({
      mode: 'merge',
      exercises_created: 0,
      exercises_matched: 0,
      workouts_created: 0,
      sets_created: 0,
    })

    renderWithClient(<SettingsPage />)
    const input = screen.getByLabelText('Backup file') as HTMLInputElement
    const file = new File([JSON.stringify(document_)], 'backup.json', {
      type: 'application/json',
    })

    fireEvent.change(input, { target: { files: [file] } })
    const merge = await screen.findByRole('dialog', { name: 'Merge backup?' })
    fireEvent.click(within(merge).getByRole('button', { name: 'Import' }))
    await screen.findByText(/Imported \(merge\)/)
    expect(input.value).toBe('')

    fireEvent.click(screen.getByLabelText(/^Replace/))
    fireEvent.change(input, { target: { files: [file] } })

    const replace = await screen.findByRole('dialog', { name: 'Replace all data?' })
    fireEvent.click(within(replace).getByRole('button', { name: 'Replace everything' }))

    await vi.waitFor(() =>
      expect(api.backup.importData).toHaveBeenCalledWith({ mode: 'replace', data: document_ }),
    )
  })

  it('rejects files that are not OpenRep backups', async () => {
    renderWithClient(<SettingsPage />)

    const file = new File([JSON.stringify({ app: 'other', version: 3 })], 'nope.json', {
      type: 'application/json',
    })
    fireEvent.change(screen.getByLabelText('Backup file'), { target: { files: [file] } })

    expect(await screen.findByText('This file is not an OpenRep v1 backup.')).toBeInTheDocument()
    expect(api.backup.importData).not.toHaveBeenCalled()
  })
})
