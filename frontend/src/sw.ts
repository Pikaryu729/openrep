import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

// Precache-only for now: no /api fetch handling here. Runtime caching and a
// local write queue for /api/* are the offline-data module's job — see
// tasks/SPEC-pwa-shell.md assumption #5. This file only precaches the built
// static app shell (JS/CSS/fonts/icons) that vite-plugin-pwa's
// injectManifest strategy injects into __WB_MANIFEST at build time.
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})
