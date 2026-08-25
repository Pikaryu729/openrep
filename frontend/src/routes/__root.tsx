import { Outlet, createRootRoute } from '@tanstack/react-router'
import { AppSidebar } from '@/components/AppSidebar'
import { BottomNav } from '@/components/BottomNav'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useOnboardingGate } from '@/lib/onboarding'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const onboarding = useOnboardingGate()
  const isMobile = useIsMobile()

  // Only on flag-absent boots, while the first-run probe is in flight:
  // render nothing rather than flashing the shell before the wizard swaps in.
  if (onboarding.status === 'pending') {
    return null
  }

  if (onboarding.status === 'wizard') {
    return <OnboardingWizard onDone={onboarding.onDone} />
  }

  // Mobile: no sidebar/header at all — a fixed bottom tab bar (BottomNav)
  // replaces them, since the off-canvas Sheet the Sidebar collapses into on
  // phones is hard to reach one-handed via its top-left hamburger.
  if (isMobile) {
    return (
      <main className="min-h-svh bg-background">
        <div className="mx-auto max-w-4xl p-4 pb-24">
          <Outlet />
        </div>
        <BottomNav />
      </main>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="max-w-4xl p-4 md:p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
