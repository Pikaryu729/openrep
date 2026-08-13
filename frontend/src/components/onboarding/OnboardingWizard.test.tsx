import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '@/lib/api'
import { ONBOARDING_STORAGE_KEY } from '@/lib/onboarding'
import { STARTER_EXERCISES } from '@/lib/starterExercises'
import { OnboardingWizard } from './OnboardingWizard'

vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>()
  return {
    ...actual,
    api: {
      exercises: {
        create: vi.fn(),
      },
    },
  }
})

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}))

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
})

function renderWizard(onDone = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <OnboardingWizard onDone={onDone} />
    </QueryClientProvider>,
  )
  return onDone
}

const nextFromWelcome = () => fireEvent.click(screen.getByRole('button', { name: 'Get started' }))
const next = () => fireEvent.click(screen.getByRole('button', { name: 'Next' }))

describe('OnboardingWizard navigation', () => {
  it('walks forward and backward through the steps', () => {
    renderWizard()

    expect(screen.getByText(/Welcome to/)).toBeInTheDocument()
    nextFromWelcome()
    expect(screen.getByText('How do you load a bar?')).toBeInTheDocument()
    next()
    expect(screen.getByText('Make it yours')).toBeInTheDocument()
    next()
    expect(screen.getByText('What do you train with?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('Make it yours')).toBeInTheDocument()
  })

  it('marks onboarding done when skipped', () => {
    const onDone = renderWizard()

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))

    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe('done')
    expect(onDone).toHaveBeenCalled()
  })
})

describe('OnboardingWizard preferences', () => {
  it('applies the units choice immediately', () => {
    renderWizard()
    nextFromWelcome()

    fireEvent.click(screen.getByTestId('onboarding-unit-imperial'))

    expect(localStorage.getItem('openrep.units')).toBe('imperial')
  })

  it('applies a theme preset immediately', () => {
    renderWizard()
    nextFromWelcome()
    next()

    fireEvent.click(screen.getByTestId('onboarding-preset-ocean'))

    expect(document.documentElement.dataset.theme).toBe('ocean')
  })
})

describe('OnboardingWizard exercises step', () => {
  const openExercisesStep = () => {
    nextFromWelcome()
    next()
    next()
  }

  it('deselects and hides an equipment group when its chip is toggled off', () => {
    renderWizard()
    openExercisesStep()

    const machineCount = STARTER_EXERCISES.filter((e) => e.equipment === 'machine').length
    expect(
      screen.getByRole('button', { name: `Add ${STARTER_EXERCISES.length} exercises` }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('onboarding-equipment-machine'))

    expect(screen.queryByLabelText('Leg Press')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: `Add ${STARTER_EXERCISES.length - machineCount} exercises`,
      }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('onboarding-equipment-machine'))
    expect(
      screen.getByRole('button', { name: `Add ${STARTER_EXERCISES.length} exercises` }),
    ).toBeInTheDocument()
  })

  it('unchecking one exercise drops it from the count', () => {
    renderWizard()
    openExercisesStep()

    fireEvent.click(screen.getByLabelText('Bench Press'))

    expect(
      screen.getByRole('button', { name: `Add ${STARTER_EXERCISES.length - 1} exercises` }),
    ).toBeInTheDocument()
  })

  it('seeds one create call per selected exercise and reports the result', async () => {
    vi.mocked(api.exercises.create).mockImplementation(async ({ name, category }) => ({
      id: 1,
      name,
      category: category ?? 'uncategorized',
      notes: null,
    }))
    const onDone = renderWizard()
    openExercisesStep()

    fireEvent.click(
      screen.getByRole('button', { name: `Add ${STARTER_EXERCISES.length} exercises` }),
    )

    expect(await screen.findByText("You're all set")).toBeInTheDocument()
    expect(api.exercises.create).toHaveBeenCalledTimes(STARTER_EXERCISES.length)
    expect(api.exercises.create).toHaveBeenCalledWith({ name: 'Bench Press', category: 'chest' })
    expect(
      screen.getByText(`Added ${STARTER_EXERCISES.length} exercises to your library.`),
    ).toBeInTheDocument()
    // Not done yet — the finish CTAs decide where to land.
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Log your first workout' }))
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe('done')
    expect(onDone).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith({ to: '/workouts' })
  })

  it('counts 409s as already existing instead of failures', async () => {
    vi.mocked(api.exercises.create).mockRejectedValue(new ApiError(409, 'exists'))
    renderWizard()
    openExercisesStep()

    fireEvent.click(
      screen.getByRole('button', { name: `Add ${STARTER_EXERCISES.length} exercises` }),
    )

    expect(await screen.findByText("You're all set")).toBeInTheDocument()
    expect(
      screen.getByText(`${STARTER_EXERCISES.length} already existed.`),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Couldn't add/)).not.toBeInTheDocument()
  })

  it('reports non-409 failures without aborting the rest', async () => {
    vi.mocked(api.exercises.create).mockImplementation(async ({ name, category }) => {
      if (name === 'Deadlift') throw new ApiError(500, 'boom')
      return { id: 1, name, category: category ?? 'uncategorized', notes: null }
    })
    renderWizard()
    openExercisesStep()

    fireEvent.click(
      screen.getByRole('button', { name: `Add ${STARTER_EXERCISES.length} exercises` }),
    )

    expect(await screen.findByText("You're all set")).toBeInTheDocument()
    expect(api.exercises.create).toHaveBeenCalledTimes(STARTER_EXERCISES.length)
    expect(screen.getByText(/Couldn't add: Deadlift\./)).toBeInTheDocument()
  })

  it('continues without seeding when nothing is selected', () => {
    renderWizard()
    openExercisesStep()

    for (const kind of ['barbell', 'dumbbell', 'machine', 'bodyweight']) {
      fireEvent.click(screen.getByTestId(`onboarding-equipment-${kind}`))
    }

    fireEvent.click(screen.getByRole('button', { name: 'Continue without exercises' }))

    expect(api.exercises.create).not.toHaveBeenCalled()
    expect(screen.getByText("You're all set")).toBeInTheDocument()
    expect(
      screen.getByText('Your exercise library is empty — add exercises as you go.'),
    ).toBeInTheDocument()
  })
})
