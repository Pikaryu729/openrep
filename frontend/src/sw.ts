import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// Precaches the built app shell. No /api handling: runtime caching of API
// data belongs to the offline-data module, not here.
precacheAndRoute(self.__WB_MANIFEST)

// Every SPA navigation gets the precached index.html, not just `/`.
// Without this, `/` served the old cached shell after an upgrade while deep
// links fetched the new one from the server, so the build you ran depended
// on the URL you opened. /api (including /api/docs) stays network-only.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api(\/|$)/],
  }),
)

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting()
})
