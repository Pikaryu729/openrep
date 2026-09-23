# Tasks: pwa-shell

Plan: `tasks/plan-pwa-shell.md`. Spec: `tasks/SPEC-pwa-shell.md`.

## Phase 1: Foundation

## Task 1: Generate PWA icon set from the brand master

**Status: done, verified.**

**Description:** Run `@vite-pwa/assets-generator` against
`assets/logo/openrep-icon-1024.png` to produce the manifest icon set
(192, 512, maskable-512) into `frontend/public/icons/`.

**Acceptance criteria:**
- [ ] `frontend/public/icons/` contains `pwa-192.png`, `pwa-512.png`,
      `maskable-512.png`
- [ ] Opening `maskable-512.png` directly, the symbol sits comfortably
      inside the safe zone (roughly the inner 80% circle) with no cropping

**Verification:**
- [ ] Manual visual check of the generated maskable icon
- [ ] `pnpm lint` (no stray files outside `public/icons/`)

**Dependencies:** None

**Files likely touched:**
- `frontend/public/icons/pwa-192.png` (new)
- `frontend/public/icons/pwa-512.png` (new)
- `frontend/public/icons/maskable-512.png` (new)
- `frontend/package.json` (devDependency: `@vite-pwa/assets-generator`)

**Estimated scope:** Small (1-2 files + generated assets)

---

## Task 2: Install `vite-plugin-pwa` and wire manifest config

**Description:** Add `vite-plugin-pwa` as a devDependency and configure it
in `vite.config.ts` with `strategies: 'injectManifest'`, `registerType:
'prompt'`, and the manifest fields specified in `SPEC-pwa-shell.md`'s Code
Style section (name, icons from Task 1, theme/background color, display,
start_url, scope).

**Acceptance criteria:**
- [ ] `pnpm build` emits `dist/manifest.webmanifest`
- [ ] Manifest JSON contains `name`, `short_name`, icons for 192/512/
      maskable, `display: "standalone"`, `start_url: "/"`, `scope: "/"`,
      correct `theme_color`/`background_color`

**Verification:**
- [ ] `pnpm build` succeeds
- [ ] Inspect `dist/manifest.webmanifest` content matches spec
- [ ] `pnpm test` (no regressions)

**Dependencies:** Task 1

**Files likely touched:**
- `frontend/vite.config.ts`
- `frontend/package.json`, `frontend/pnpm-lock.yaml`

**Estimated scope:** Small (1-2 files)

---

## Task 3: Add `src/sw.ts` (precache-only) and register it on boot

**Description:** Create the `injectManifest` entry file with only
`precacheAndRoute(self.__WB_MANIFEST)` — no `/api` handling. Wire SW
registration into the app entry via vite-plugin-pwa's virtual register
module.

**Acceptance criteria:**
- [ ] `pnpm build` emits `dist/sw.js`
- [ ] Against `pnpm build && pnpm preview`, `navigator.serviceWorker.ready`
      resolves in the browser
- [ ] A request to `/api/exercises` is not intercepted by the SW (passes
      straight to network — verified manually via DevTools Network panel
      for this task; automated in Task 7)

**Verification:**
- [ ] `pnpm build && pnpm preview`, manual DevTools Application-tab check
      that the SW is registered and active
- [ ] `pnpm test` (no regressions)

**Dependencies:** Task 2

**Files likely touched:**
- `frontend/src/sw.ts` (new)
- `frontend/src/main.tsx`

**Estimated scope:** Small (1-2 files)

---

## Task 4: Add light/dark `theme-color` meta tags to `index.html`

**Description:** Add two `<meta name="theme-color">` tags split by
`prefers-color-scheme`, mirroring the existing light/dark `<link
rel="icon">` pattern already in `index.html`. Add the manifest `<link>` if
`vite-plugin-pwa` doesn't inject it automatically.

**Acceptance criteria:**
- [ ] `index.html` (and built `dist/index.html`) has both theme-color meta
      tags and a manifest link

**Verification:**
- [ ] `pnpm build`; grep `dist/index.html` for the new tags
- [ ] Full on-device confirmation deferred to Task 8

**Dependencies:** None (parallel to Tasks 1-3)

**Files likely touched:**
- `frontend/index.html`

**Estimated scope:** Small (1 file)

---

## Checkpoint: Foundation (after Tasks 1-4)
- [ ] `pnpm build` succeeds, emits manifest + SW + icons into `dist/`
- [ ] `pnpm test` and `pnpm lint` pass
- [ ] Manifest fields verified against spec
- [ ] **Review with human before proceeding to Phase 2**

## Phase 2: Install / update UX

## Task 5: `useInstallPrompt` hook + `InstallPrompt` Settings card

**Description:** Build a hook that captures the `beforeinstallprompt` event
(Android/Chrome) and detects iOS Safari via UA + `navigator.standalone`/
`matchMedia('(display-mode: standalone)')`. Build `InstallPrompt.tsx`, a
shadcn `Card` in Settings with three render branches: native install button,
static iOS instructions, or nothing when already installed.

**Acceptance criteria:**
- [ ] Hook correctly classifies platform given a mocked UA + event presence
- [ ] Component renders the correct branch for each of the three cases
- [ ] Card is wired into `routes/settings.tsx`

**Verification:**
- [ ] `pnpm exec vitest run src/components/InstallPrompt.test.tsx`
- [ ] `pnpm test` (full suite), `pnpm lint`

**Dependencies:** Checkpoint: Foundation

**Files likely touched:**
- `frontend/src/components/InstallPrompt.tsx` (new)
- `frontend/src/components/InstallPrompt.test.tsx` (new)
- `frontend/src/routes/settings.tsx`

**Estimated scope:** Medium (3-4 files)

---

## Task 6: `useRegisterSW`-based `UpdatePrompt`

**Description:** Wrap `vite-plugin-pwa`'s `virtual:pwa-register/react`
`useRegisterSW()` hook. Render an update toast/banner only when
`needRefresh` is true; "Reload" calls `updateServiceWorker(true)`. Mount at
the root layout so it's visible app-wide, both mobile and desktop.

**Acceptance criteria:**
- [ ] Renders nothing when `needRefresh` is false
- [ ] Renders the update UI when `needRefresh` is true (mocked hook)
- [ ] "Reload" button calls `updateServiceWorker(true)`

**Verification:**
- [ ] `pnpm exec vitest run src/components/UpdatePrompt.test.tsx`
- [ ] `pnpm test`, `pnpm lint`

**Dependencies:** Task 3, Checkpoint: Foundation

**Files likely touched:**
- `frontend/src/components/UpdatePrompt.tsx` (new)
- `frontend/src/components/UpdatePrompt.test.tsx` (new)
- `frontend/src/routes/__root.tsx`

**Estimated scope:** Small-Medium (2-3 files)

---

## Checkpoint: UX (after Tasks 5-6)
- [ ] `pnpm test` (including new component tests) passes
- [ ] `pnpm lint` and `pnpm build` clean
- [ ] **Review with human before proceeding to Phase 3**

## Phase 3: Verification

## Task 7: e2e spec — manifest, SW registration, `/api/*` passthrough

**Status: done, verified.**

**Description:** Write `e2e/tests/pwa-install.spec.ts`: fetch and validate
`manifest.webmanifest`, confirm `navigator.serviceWorker.ready` resolves
against a production build, and assert a request to `/api/exercises` still
reaches the network with the SW active. Requires resolving the open question
in `plan-pwa-shell.md` about testing against `pnpm build && pnpm preview`
rather than `pnpm dev`.

Resolved via a **separate config file**, `e2e/playwright.pwa.config.ts`
(not a second project in the existing config — Playwright's `webServer` is
global to a config file, not scopable per-project). It runs only
`pwa-install.spec.ts` (`testMatch`), boots the backend on a new dedicated
`PWA_BACKEND_PORT` (8767) sharing the main suite's throwaway
`e2e/.tmp/e2e.db` (this spec is GET-only, nothing to corrupt), and boots the
frontend via `pnpm build && pnpm preview --port <PWA_FRONTEND_PORT (5175)>
--strictPort` instead of `dev`, so `vite-plugin-pwa`'s real `injectManifest`
output (`dist/sw.js`, `dist/manifest.webmanifest`) is what's served. The
main `playwright.config.ts` gained `testIgnore: '**/pwa-install.spec.ts'`
so `pnpm test` never tries to run it against the dev server (no real SW
there). New `e2e/package.json` script: `test:pwa`.

**Acceptance criteria:**
- [x] Spec passes against the production build
- [x] `/api/*` passthrough assertion is a real regression guard (fails if
      someone later adds caching for it without updating this spec) —
      asserts `response.fromServiceWorker() === false`

**Verification:**
- [x] `pnpm exec playwright test tests/pwa-install.spec.ts --config=playwright.pwa.config.ts` — 3 passed
- [x] Full e2e suite (`pnpm test` in `e2e/`) still green — 17 passed, and
      `pwa-install.spec.ts` confirmed absent from `--list` output

**Dependencies:** Tasks 1-4, Task 3

**Files likely touched:**
- `e2e/tests/pwa-install.spec.ts` (new)
- `e2e/playwright.pwa.config.ts` (new — separate config, see resolution above)
- `e2e/playwright.config.ts` (added `testIgnore`)
- `e2e/support/ports.ts` (added `PWA_FRONTEND_PORT`/`PWA_BACKEND_PORT`/
  `PWA_FRONTEND_ORIGIN`, existing constants untouched)
- `e2e/package.json` (added `test:pwa` script)

**Estimated scope:** Medium (1-2 files, but new e2e infra if the open
question resolves toward a second Playwright project)

---

## Task 8: Packaging check + manual device QA

**Description:** Run `scripts/build-dist.sh` and `scripts/smoke-wheel.sh` to
confirm the manifest/SW/icons land inside the wheel and are served correctly
by `openrep/spa.py`. Then manually install on an Android Chrome device and
an iOS Safari device, both on the same LAN as a running backend, and walk
through the spec's on-device Success Criteria (standalone launch, icon,
safe-area behavior, update-prompt flow after a rebuild).

**Acceptance criteria:**
- [ ] `build-dist.sh` and `smoke-wheel.sh` both succeed
- [ ] Android Chrome: install offered, standalone launch, correct icon,
      safe-area insets intact
- [ ] iOS Safari: Settings shows install instructions, manual "Add to Home
      Screen" produces a standalone launch with correct icon
- [ ] Update flow: after a rebuild+redeploy, reopening the app shows the
      update prompt and only updates on confirmation

**Verification:**
- [x] `./scripts/build-dist.sh` — succeeds, `manifest.webmanifest`/`sw.js`/
      `icons/*` confirmed present in the built wheel
- [x] `./scripts/smoke-wheel.sh` — all checks pass against a real venv
      install of the wheel
- [x] Supplementary live-boot check (beyond what `smoke-wheel.sh` covers,
      since it predates this feature): booted the packaged wheel and
      curled `/manifest.webmanifest` (200, `application/manifest+json`),
      `/sw.js` (200, `text/javascript`), `/icons/pwa-512.png` (200,
      `image/png`), and confirmed both `theme-color` meta tags in `/`
- [ ] Manual device walkthrough (checklist above) — **BLOCKED: no physical
      Android or iOS device reachable from this environment.** Needs a
      human. See `plan-pwa-shell.md`'s "Hard blocker note" for exactly
      what's left to check.

**Dependencies:** Tasks 1-7

**Files likely touched:** None (verification only; may surface follow-up
bugs to file as new tasks)

**Estimated scope:** Small as a task (device access is the practical
bottleneck, not code)

---

## Checkpoint: Complete (after Task 8)
- [x] All automatable Success Criteria in `SPEC-pwa-shell.md` met
- [x] Full `pnpm test`, `pnpm lint`, e2e suite (both configs),
      `build-dist.sh`, `smoke-wheel.sh` all green
- [ ] Manual device QA confirmed on both platforms — **blocked on a human
      with a phone**
- [ ] Ready for review / merge, pending the manual QA above — code itself
      is ready; `offline-data` (next module) can start once this is
      reviewed
