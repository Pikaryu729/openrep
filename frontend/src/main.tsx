import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { startInstallPromptCapture } from './lib/installPrompt'
import { initTheme } from './lib/theme'
import { routeTree } from './routeTree.gen'

// The boot script in index.html replays persisted vars to prevent FOUC; this
// recomputes them from current code so shipped token changes actually land.
initTheme()

// Must run at the app shell, not in the Settings card that renders the install
// button: Chrome fires `beforeinstallprompt` once, shortly after load, and
// drops it if nothing is listening. A listener that mounted with the Settings
// route missed it for the whole session unless the user happened to be sitting
// on Settings during the initial load.
startInstallPromptCapture()

// Service worker registration lives in <UpdatePrompt> (mounted in
// routes/__root.tsx), via virtual:pwa-register/react's useRegisterSW —  not
// here. useRegisterSW performs its own registration internally, so calling
// the imperative virtual:pwa-register's registerSW() here too would register
// the same service worker twice under two independent Workbox instances.
// registerType: 'prompt' (vite.config.ts) still means neither path silently
// swaps in a new worker mid-session — UpdatePrompt's Reload button is the
// only place that confirms the swap.

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
