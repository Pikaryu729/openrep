import { useQuery } from '@tanstack/react-query'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AppSidebar } from '@/components/AppSidebar'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { api } from '@/lib/api'
import { shouldShowOnboarding, useOnboardingFlag } from '@/lib/onboarding'

export const Route = createRootRoute({
  component: RootLayout,
})

/**
 * First-run gate: the wizard takes over for a fresh database (both lists
 * confirmed empty) or when Settings sets the 'replay' flag. The latch keeps
 * it up mid-wizard — seeding makes the exercises list non-empty — until the
 * wizard itself reports done. Pending or failed queries render the app
 * normally: an unreachable backend must never trap the user in onboarding.
 */
function useOnboardingGate(): { active: boolean; onDone: () => void } {
  const flag = useOnboardingFlag()
  const exercises = useQuery({ queryKey: ['exercises'], queryFn: api.exercises.list })
  const workouts = useQuery({ queryKey: ['workouts'], queryFn: () => api.workouts.list() })
  const [latched, setLatched] = useState(false)

  const show = shouldShowOnboarding(
    flag,
    exercises.isSuccess ? exercises.data.length === 0 : undefined,
    workouts.isSuccess ? workouts.data.length === 0 : undefined,
  )

  useEffect(() => {
    if (show) setLatched(true)
  }, [show])

  return { active: show || latched, onDone: () => setLatched(false) }
}

function RootLayout() {
  const onboarding = useOnboardingGate()

  if (onboarding.active) {
    return <OnboardingWizard onDone={onboarding.onDone} />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="max-w-4xl p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
