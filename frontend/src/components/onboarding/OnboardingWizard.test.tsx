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

// The wizard ignores Next activations within 300ms of a step change (the
// double-click guard), so the clock is mocked and advanced per click.
let now = 0

beforeEach(() => {
  now = 1_000_000
  vi.spyOn(Date, 'now').mockImplementation(() => now)
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
  vi.restoreAllMocks()
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

/** Click after letting the step-transition guard expire. */
const click = (element: Element) => {
  now += 400
  fireEvent.click(element)
}

const nextFromWelcome = () => click(screen.getByRole('button', { name: 'Get started' }))
const next = () => click(screen.getByRole('button', { name: 'Next' }))

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

  it('never swallows plain navigation, however fast the clicks come', () => {
    // Only the seed action is debounced. Rapid Next clicks (keyboard users,
    // Playwright) must keep advancing — this is the e2e cadence that a
    // whole-wizard guard silently broke.
    renderWizard()

    fireEvent.click(screen.getByRole('button', { name: 'Get started' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))

    expect(screen.getByText('Make it yours')).toBeInTheDocument()
    expect(screen.getByText('Step 3 of 5')).toBeInTheDocument()
  })

  it('ignores the second activation of a double-click instead of firing the seed', () => {
    renderWizard()
    nextFromWelcome()
    next()

    // Double-click on Appearance: the first activation advances to the
    // exercises step, so the second lands on its seed button.
    now += 400
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    fireEvent.click(screen.getByRole('button', { name: /Add \d+ exercises/ }))

    expect(screen.getByText('What do you train with?')).toBeInTheDocument()
    expect(screen.getByText('Step 4 of 5')).toBeInTheDocument()
    expect(api.exercises.create).not.toHaveBeenCalled()
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

    click(screen.getByRole('button', { name: `Add ${STARTER_EXERCISES.length} exercises` }))

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

    click(screen.getByRole('button', { name: `Add ${STARTER_EXERCISES.length} exercises` }))

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

    click(screen.getByRole('button', { name: `Add ${STARTER_EXERCISES.length} exercises` }))

    expect(await screen.findByText("You're all set")).toBeInTheDocument()
    expect(api.exercises.create).toHaveBeenCalledTimes(STARTER_EXERCISES.length)
    expect(screen.getByText(/Couldn't add: Deadlift\./)).toBeInTheDocument()
  })

  it('owns a wholesale failure and retries from the exercises step', async () => {
    vi.mocked(api.exercises.create).mockRejectedValue(new ApiError(500, 'backend down'))
    renderWizard()
    openExercisesStep()

    click(screen.getByRole('button', { name: `Add ${STARTER_EXERCISES.length} exercises` }))

    expect(
      await screen.findByText(/none of the selected exercises were added/),
    ).toBeInTheDocument()
    expect(screen.queryByText("You're all set")).not.toBeInTheDocument()
    // The user may still proceed without the starter library.
    expect(screen.getByRole('button', { name: 'Log your first workout' })).toBeInTheDocument()

    click(screen.getByRole('button', { name: 'Try again' }))

    // Back on the exercises step with the mutation reset, so seeding re-runs.
    expect(screen.getByText('What do you train with?')).toBeInTheDocument()
    vi.mocked(api.exercises.create).mockImplementation(async ({ name, category }) => ({
      id: 1,
      name,
      category: category ?? 'uncategorized',
      notes: null,
    }))
    click(screen.getByRole('button', { name: `Add ${STARTER_EXERCISES.length} exercises` }))

    expect(await screen.findByText("You're all set")).toBeInTheDocument()
    expect(api.exercises.create).toHaveBeenCalledTimes(STARTER_EXERCISES.length * 2)
    expect(
      screen.getByText(`Added ${STARTER_EXERCISES.length} exercises to your library.`),
    ).toBeInTheDocument()
  })

  it('continues without seeding when nothing is selected', () => {
    renderWizard()
    openExercisesStep()

    for (const kind of ['barbell', 'dumbbell', 'machine', 'bodyweight']) {
      fireEvent.click(screen.getByTestId(`onboarding-equipment-${kind}`))
    }

    click(screen.getByRole('button', { name: 'Continue without exercises' }))

    expect(api.exercises.create).not.toHaveBeenCalled()
    expect(screen.getByText("You're all set")).toBeInTheDocument()
    expect(
      screen.getByText('Your exercise library is empty — add exercises as you go.'),
    ).toBeInTheDocument()
  })
})
