import { Outlet, createRootRoute } from '@tanstack/react-router'
import { AppSidebar } from '@/components/AppSidebar'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { useOnboardingGate } from '@/lib/onboarding'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const onboarding = useOnboardingGate()

  // Only on flag-absent boots, while the first-run probe is in flight:
  // render nothing rather than flashing the shell before the wizard swaps in.
  if (onboarding.status === 'pending') {
    return null
  }

  if (onboarding.status === 'wizard') {
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
