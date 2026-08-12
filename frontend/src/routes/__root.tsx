import { Outlet, createRootRoute } from '@tanstack/react-router'
import { AppSidebar } from '@/components/AppSidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
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
