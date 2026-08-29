# Spec: PWA Shell (installability)

Module id: `pwa-shell` — see `tasks/CAPABILITY-MAP-pwa.md` for the parent map.
Depends on: — (first module in build order)

## Assumptions I'm making

1. Package: `vite-plugin-pwa`, in `strategies: 'injectManifest'` mode (we
   supply `frontend/src/sw.ts`, the plugin injects the precache manifest into
   it), **not** `generateSW`. Reason: the `offline-data` module (next in the
   build order) needs custom `fetch` handling — a local write queue and
   cache-then-network reads for `/api/*` — which `generateSW`'s declarative
   config can't express. Starting on `injectManifest` now avoids rewriting
   the whole SW registration path when that module lands.
2. Icon source: `assets/logo/openrep-icon-1024.png` (dark-on-light) generated
   via `@vite-pwa/assets-generator`, output copied into `frontend/public/`
   alongside the existing favicon set — following the existing brand-asset
   convention (masters in `assets/`, servable subset in `frontend/public/`).
3. `registerType: 'prompt'`, not `'autoUpdate'`. A silent SW swap-and-reload
   mid-set (while someone is mid-workout, logging weights) would discard
   in-progress form state. The user must confirm before the new version
   activates.
4. Manifest `theme_color`/`background_color` are static (read once, mainly
   for the OS splash before first paint) — they use the **light** mode
   defaults (`--accent: #3f3f46`, `--background: #f6f6f7` from
   `src/index.css`), since manifest.json cannot follow the user's live theme.
   Live browser-chrome color instead comes from `<meta name="theme-color">`
   tags split by `prefers-color-scheme`, mirroring the light/dark `<link
   rel="icon">` pattern index.html already uses for favicons.
5. `/api/*` requests are explicitly **not** intercepted by the service
   worker in this module — no caching, no offline fallback for API calls.
   That's `offline-data`'s job. This module only precaches the built static
   app shell (JS/CSS/fonts/icons).
6. Install UX lives in **Settings**, not an unsolicited banner: a new card
   that shows a native "Install" button (Android/Chrome, via
   `beforeinstallprompt`) or static "Add to Home Screen" instructions (iOS
   Safari, which has no install API). No first-run popup, no dismissed-state
   tracking to build.
7. App name: `OpenRep` for both `name` and `short_name` (already short
   enough that no truncated variant is needed).

→ Correct any of these now or I'll proceed with them.

## Objective

Make OpenRep installable on a phone as a standalone, app-like PWA — home
screen icon, no browser chrome, safe update flow — building on the mobile
shell (bottom tab bar, safe-area insets) already merged on this branch. This
module covers installability and the service-worker skeleton only; it does
not change offline/network behavior for API calls (see `offline-data`).

Success looks like: a user on the same home LAN as their OpenRep backend
opens the app in Chrome (Android) or Safari (iOS), installs it to their home
screen, and subsequently launches it as a standalone app that looks and
updates like a native one.

## Tech Stack

- `vite-plugin-pwa` (workbox-based), `injectManifest` strategy — new
  frontend devDependency.
- `@vite-pwa/assets-generator` — dev-only CLI, generates the full PWA icon
  set from one source PNG. Not a runtime dependency.
- No new backend dependencies. No change to `openrep/spa.py`'s static-file
  serving beyond the new files vite emits into `frontend/dist/` (already
  copied into the wheel by `scripts/build-dist.sh`).

## Commands

```bash
# one-time setup
cd frontend
pnpm add -D vite-plugin-pwa @vite-pwa/assets-generator

# regenerate the PWA icon set from the brand master (re-run whenever
# assets/logo/openrep-icon-1024.png changes)
pnpm exec pwa-assets-generator --preset minimal ../assets/logo/openrep-icon-1024.png

# existing commands, unchanged
pnpm dev                        # dev server on :5173
pnpm build                      # typecheck + production build (now also emits sw.js + manifest.webmanifest)
pnpm test                       # vitest run
pnpm exec vitest run src/components/InstallPrompt.test.tsx
```

```bash
cd e2e
pnpm exec playwright test tests/pwa-install.spec.ts
```

## Project Structure

```
frontend/
  src/
    sw.ts                       → service worker source (injectManifest entry)
    components/
      InstallPrompt.tsx         → Settings card: native install button (Android)
                                   or "Add to Home Screen" instructions (iOS)
      InstallPrompt.test.tsx
      UpdatePrompt.tsx           → toast/banner shown when a new SW is waiting
      UpdatePrompt.test.tsx
    routes/
      settings.tsx               → gains the InstallPrompt card
  public/
    icons/                       → generated PWA icon set (192, 512, maskable)
  vite.config.ts                 → VitePWA({ strategies: 'injectManifest', ... })
  index.html                     → adds <meta name="theme-color"> (light/dark), manifest link
e2e/
  tests/
    pwa-install.spec.ts          → manifest served + valid, SW registers, /api/* untouched
```

## Code Style

`vite.config.ts` plugin registration, matching the existing plugin-array
style (`@tailwindcss/vite`, `@vitejs/plugin-react`, `tanstackRouter`):

```ts
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      manifest: {
        name: 'OpenRep',
        short_name: 'OpenRep',
        description: 'A local-first strength training tracker.',
        theme_color: '#3f3f46',
        background_color: '#f6f6f7',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
})
```

`src/sw.ts`, minimal `injectManifest` entry — precache only, no `/api`
handling (that's `offline-data`'s addition later):

```ts
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope
precacheAndRoute(self.__WB_MANIFEST)
```

`index.html` theme-color, mirroring the existing favicon light/dark split:

```html
<meta name="theme-color" content="#f6f6f7" media="(prefers-color-scheme: light)" />
<meta name="theme-color" content="#131316" media="(prefers-color-scheme: dark)" />
```

`InstallPrompt.tsx` follows existing component conventions: a shadcn `Card`
in Settings, Tailwind utilities + `cn()`, no bespoke CSS. Platform detection
(`beforeinstallprompt` support vs. iOS Safari) is a small hook
(`useInstallPrompt()`) so the branching logic is unit-testable independent
of the Card markup.

## Testing Strategy

- **Vitest** (colocated `*.test.tsx`, existing per-method `vi.mock` pattern):
  - `useInstallPrompt` hook: correctly classifies platform given a mocked UA
    string and `beforeinstallprompt` event presence/absence.
  - `InstallPrompt`: renders the native-install button when the event fires,
    renders static iOS instructions when UA matches iOS and the app isn't
    already `standalone`, renders nothing when already installed
    (`navigator.standalone` / `matchMedia('(display-mode: standalone)')`).
  - `UpdatePrompt`: renders only when `useRegisterSW()`'s
    `needRefresh` is true; clicking "Reload" calls `updateServiceWorker(true)`.
- **Playwright** (`e2e/tests/pwa-install.spec.ts`):
  - `GET /manifest.webmanifest` (served by the built app) returns valid JSON
    with `name`, `icons` (≥192 and ≥512), `display: standalone`, `start_url`.
  - Service worker registers on load (`navigator.serviceWorker.ready`
    resolves) when running against the production build (`pnpm build &&
    pnpm preview`, not `pnpm dev` — Vite's dev server doesn't run the real
    SW pipeline).
  - A request to `/api/exercises` while the SW is active still hits the
    network (asserted via `page.route`/response inspection) — regression
    guard for assumption #5, so a future change can't accidentally start
    caching API responses in this module.
- **Manual, on real devices** (this module is OS-integration-heavy in ways
  Playwright's Chromium can't fully exercise): install on Android Chrome and
  confirm standalone launch + icon; install via iOS Safari's real "Add to
  Home Screen" (Playwright doesn't run Safari) and confirm the same. Do this
  before calling the module done, consistent with testing UI changes in a
  real browser rather than only asserting via tooling.

## Boundaries

- **Always:** regenerate icons from `assets/logo/openrep-icon-1024.png`
  through the asset-generator command above rather than hand-exporting PNGs;
  verify `pnpm build` actually emits `sw.js`/`manifest.webmanifest` into
  `dist/` and that `scripts/build-dist.sh`'s wheel-content check still passes;
  test the real install flow on an Android device and an iOS device before
  considering this module done.
- **Ask first:** adding `vite-plugin-pwa`/`@vite-pwa/assets-generator` as
  dependencies (flagging here now — confirm before I add them); any change
  to `openrep/spa.py`'s static-serving/path-traversal guard, since it's
  called out as security-sensitive in CLAUDE.md.
- **Never:** have the service worker intercept or cache `/api/*` in this
  module (reserved for `offline-data`, which needs to design staleness and
  queue interaction deliberately); use `registerType: 'autoUpdate'` (silent
  reload risks losing in-progress workout-logging state); commit generated
  icon files that didn't come from the `assets/logo` master pipeline.

## Success Criteria

- `pnpm build` emits a valid `manifest.webmanifest` and `sw.js`, both linked
  from `index.html`, and `scripts/build-dist.sh` still succeeds (UI +
  migrations still land correctly in the wheel).
- Lighthouse's installability audit (or manual equivalent) passes: manifest
  has name/short_name, 192 + 512 icons (one maskable), `display: standalone`,
  valid `start_url`/`scope`; SW registers successfully.
- On Android Chrome (phone on the same LAN as the backend), the browser
  offers "Install app"; after installing, the app launches with no browser
  chrome and correct safe-area behavior (reusing the existing mobile-nav
  insets work).
- On iOS Safari, Settings shows install instructions when not yet installed;
  after a manual "Add to Home Screen," the app launches standalone with the
  correct icon and no added FOUC beyond what `index.html`'s existing theme
  boot script already handles.
- Publishing a new build and reopening the app surfaces an update prompt;
  the app only updates to the new SW after the user confirms — never
  silently mid-session.
- `/api/*` requests are provably unaffected by the SW (e2e-asserted).
- No regressions in existing `pnpm test` / `pnpm exec playwright test`.

## Open Questions

1. Is a Settings-only install card sufficient, or do you also want a
   dismissible first-run banner? (Proposed: Settings-only, to avoid extra
   dismissed-state persistence for a v1.)
2. Does the 1024px icon master have enough padding around the symbol for an
   automatic maskable safe-zone, or does design need to produce a dedicated
   maskable-safe source? (Will check visually once icons are generated;
   flagging in case the answer is "commission new art.")
