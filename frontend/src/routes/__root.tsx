import { Outlet, createRootRoute } from '@tanstack/react-router'
import { AppSidebar } from '@/components/AppSidebar'
import { BottomNav } from '@/components/BottomNav'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { UpdatePrompt } from '@/components/UpdatePrompt'
import { useIsMobile } from '@/hooks/use-mobile'
import { useOnboardingGate } from '@/lib/onboarding'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  const onboarding = useOnboardingGate()

  return (
    <>
      {/* Only on flag-absent boots, while the first-run probe is in flight:
          render nothing rather than flashing the shell before the wizard
          swaps in. */}
      {onboarding.status === 'pending' ? null : onboarding.status === 'wizard' ? (
        <OnboardingWizard onDone={onboarding.onDone} />
      ) : (
        <AppShell />
      )}
      {/* Deliberately outside the onboarding gate: this owns the app's single
          service-worker registration, so gating it behind the wizard left
          first-run users with no worker registered at all, and no way to
          surface an update shipped while the wizard was still up. */}
      <UpdatePrompt />
    </>
  )
}

function AppShell() {
  const isMobile = useIsMobile()

  return (
    <SidebarProvider>
      <AppSidebar hidden={isMobile} />
      <SidebarInset>
        <header
          className={isMobile ? 'hidden' : 'flex h-14 items-center gap-2 border-b px-4'}
        >
          {!isMobile && <SidebarTrigger />}
        </header>
        <main
          className={
            isMobile ? 'mx-auto max-w-4xl p-4 pb-24' : 'max-w-4xl p-4 md:p-8'
          }
          style={
            isMobile
              ? {
                  paddingTop: 'calc(1rem + env(safe-area-inset-top))',
                  paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
                  paddingRight: 'calc(1rem + env(safe-area-inset-right))',
                }
              : undefined
          }
        >
          <Outlet />
        </main>
      </SidebarInset>
      {isMobile && <BottomNav />}
    </SidebarProvider>
  )
}
