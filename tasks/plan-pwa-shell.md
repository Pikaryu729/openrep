# Implementation Plan: pwa-shell

Source spec: `tasks/SPEC-pwa-shell.md`. No external tracker is designated by
this project's CLAUDE.md, so tasks are recorded in `tasks/todo-pwa-shell.md`
(module-suffixed to match the capability map's multi-module layout, in place
of the skill's unscoped `tasks/todo.md` default).

## Overview

Wire `vite-plugin-pwa` (injectManifest strategy) into the frontend build so
OpenRep ships a valid web manifest, a minimal precache-only service worker,
and platform-appropriate install/update UX — without touching how `/api/*`
requests behave (that's `offline-data`'s job next).

## Architecture Decisions

- **`injectManifest` over `generateSW`**: we own `src/sw.ts` directly so the
  next module (`offline-data`) can add write-queue and `/api` cache logic to
  the same file instead of migrating strategies later.
- **`registerType: 'prompt'`**: no silent SW takeover mid-workout; the user
  explicitly confirms via `UpdatePrompt`.
- **Icons generated from the existing brand master** (`assets/logo/openrep-
  icon-1024.png`), not hand-exported, to stay inside the documented
  masters-in-`assets/`-servable-copies-in-`frontend/public/` convention.
- **Settings-only install UX**, no first-run banner (approved in spec).

## Dependency Graph

```
assets/logo/openrep-icon-1024.png (exists)
    │
    ├─→ [1] Generate PWA icon set
    │        │
    │        ▼
    │   [2] Install vite-plugin-pwa + manifest config (vite.config.ts)
    │        │
    │        ▼
    │   [3] src/sw.ts (precache-only) + registration in main.tsx
    │        │
    ├────────┼──────────────┐
    │        ▼               ▼
    │   [5] InstallPrompt   [6] UpdatePrompt
    │        (Settings)        (root layout, needs [3]'s registration)
    │        │               │
    │        └───────┬───────┘
    │                ▼
    │           [7] e2e: manifest + SW registration + /api passthrough
    │                │
[4] index.html theme-color meta tags (independent, parallel to 1-3)
    │                │
    └────────────────┴─→ [8] build-dist.sh / smoke-wheel.sh + manual device QA
```

Build order follows this graph: foundation (1→2→3, with 4 in parallel), then
UX (5, 6), then verification (7, 8).

## Task List

### Phase 1: Foundation

- [x] Task 1: Generate PWA icon set from the brand master
- [x] Task 2: Install `vite-plugin-pwa` and wire manifest config
- [x] Task 3: Add `src/sw.ts` (precache-only) and register it on boot
- [x] Task 4: Add light/dark `theme-color` meta tags to `index.html`

### Checkpoint: Foundation
- [x] `pnpm build` succeeds and emits `manifest.webmanifest` + `sw.js` +
      icons into `dist/`
- [x] `pnpm test` and `pnpm lint` still pass (no regressions — 135
      pre-existing failures confirmed unrelated via baseline stash/pop)
- [x] Manifest content matches the spec's fields (name, icons, display,
      start_url, scope, theme/background color)
- [x] Review with human before starting Phase 2

### Phase 2: Install / update UX

- [x] Task 5: `useInstallPrompt` hook + `InstallPrompt` Settings card
- [x] Task 6: `useRegisterSW`-based `UpdatePrompt`, mounted at root layout
      (also removed the now-redundant imperative `registerSW()` call from
      `main.tsx` — `useRegisterSW` performs its own registration; verified
      against `vite-plugin-pwa`'s built source)

### Checkpoint: UX
- [x] `pnpm test` (including new `InstallPrompt.test.tsx` /
      `UpdatePrompt.test.tsx`) passes — 151 passed (144 baseline + 7 new),
      135 pre-existing failures unchanged
- [x] `pnpm lint` and `pnpm build` clean (one sanctioned
      `only-export-components` warning, same pattern as ~15 other files)
- [x] Review with human before starting Phase 3 (resumed, told to continue
      to completion or a hard blocker)

### Phase 3: Verification

- [x] Task 7: e2e spec — manifest served, SW registers, `/api/*` unaffected
- [x] Task 8a: `build-dist.sh` / `smoke-wheel.sh` (automated half — verified)
- [ ] Task 8b: manual device QA (Android Chrome + iOS Safari, both on the
      home LAN) — **blocked: no physical device available in this
      environment.** See note below.

### Checkpoint: Complete
- [x] All automatable Success Criteria in `SPEC-pwa-shell.md` met
- [x] Full `pnpm test`, `pnpm lint`, e2e suite (both configs),
      `build-dist.sh`, `smoke-wheel.sh` all green
- [ ] Manual device QA confirmed on both platforms — **blocked, needs a
      human with a phone**
- [ ] Ready for review / merge, pending the manual QA above

**Hard blocker note:** Task 8's manual device QA (installing on a real
Android Chrome and iOS Safari device, on the home LAN) cannot be performed
from this environment — no physical or emulated mobile device is reachable.
Everything automatable is done and green: build, lint, both test suites
(vitest + both Playwright configs), the wheel build, and a live boot of the
packaged wheel confirming `/manifest.webmanifest` (200,
`application/manifest+json`), `/sw.js` (200, `text/javascript`), and
`/icons/pwa-512.png` (200, `image/png`) are all served correctly with the
right theme-color meta tags in `/`. What remains is purely the on-device
walkthrough in `SPEC-pwa-shell.md`'s Success Criteria — install offered on
Android, "Add to Home Screen" instructions correct on iOS, standalone
launch, icon, safe-area behavior, and the update-prompt flow after a
rebuild. This needs a human with an Android phone and an iPhone on the same
LAN as a running `openrep` backend.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| iOS Safari has no `beforeinstallprompt` | Med | Static instructions branch in `InstallPrompt`, already in spec |
| `pnpm dev` doesn't run the real SW pipeline (Vite dev server bypasses it) | Med | Task 7's e2e spec must run against `pnpm build && pnpm preview`, not dev — may need a distinct Playwright project (open question below) |
| Playwright/Chromium can't drive a real iOS "Add to Home Screen" flow | Med | Task 8 manual device QA is explicit and not CI-blocking |
| `injectManifest`'s `self.__WB_MANIFEST` requires matching `vite-plugin-pwa`/workbox versions | Low | Pin versions per `vite-plugin-pwa`'s documented compatible range at install (Task 2) |
| Maskable icon safe-zone may crop the symbol if the 1024 master lacks padding | Low | Task 1 requires a manual visual check before proceeding |

## Open Questions

1. ~~`playwright.config.ts`'s `webServer` currently boots `pnpm dev`...~~
   **Resolved:** add a second Playwright project with its own `webServer`
   entry (`pnpm build && pnpm preview`), scoped to `pwa-install.spec.ts`
   only. This is Task 7's job.
