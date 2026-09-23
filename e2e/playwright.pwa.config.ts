import { defineConfig, devices } from '@playwright/test'
import { PWA_BACKEND_PORT, PWA_FRONTEND_ORIGIN, PWA_FRONTEND_PORT } from './support/ports'

// Separate from playwright.config.ts on purpose: Playwright's `webServer` is
// global to a config file, not scopable per-project, and this spec needs a
// fundamentally different frontend server than every other spec in the repo.
//
// vite-plugin-pwa's `injectManifest` build (src/sw.ts -> dist/sw.js,
// manifest.webmanifest) only happens during `vite build`. Vite's dev server
// (what the main config's webServer runs via `pnpm dev`) never runs that
// pipeline, so there is no real service worker to register against there —
// pwa-install.spec.ts needs `vite build` + `vite preview` instead. Bundling
// that heavier build+preview flow into the main config would slow down every
// other spec for a concern only this one file cares about, hence a dedicated
// config restricted to just pwa-install.spec.ts (see testMatch below) and
// invoked via the separate `test:pwa` script in package.json.
//
// Backend: reuses the same webServer command/health-check shape as
// playwright.config.ts, on its own dedicated port (PWA_BACKEND_PORT, see
// support/ports.ts) so it can never collide with the main suite's backend if
// both ran concurrently. It shares the main suite's throwaway DB file
// (e2e/.tmp/e2e.db) rather than getting its own: this spec only issues GET
// requests (manifest fetch, SW registration, an /api/exercises passthrough
// check) and never mutates data, so there is nothing for it to corrupt by
// sharing the file, and a second throwaway DB would be one more thing to
// remember to clean up for no real isolation benefit.
export default defineConfig({
  testDir: './tests',
  // Restrict to just this one spec — see header comment for why the rest of
  // the suite must not run through this heavier build+preview config.
  testMatch: 'pwa-install.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: PWA_FRONTEND_ORIGIN,
    trace: 'on-first-retry',
    // Same rationale as playwright.config.ts, and load-bearing here: browser
    // contexts start with empty localStorage and the shared throwaway DB is
    // empty on a fresh checkout, which is exactly the state that sends the app
    // into the first-run wizard. The wizard renders instead of the shell, so
    // nothing that registers a service worker ever mounts and every
    // `navigator.serviceWorker.ready` await in this spec blocks until timeout.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: PWA_FRONTEND_ORIGIN,
          localStorage: [{ name: 'openrep.onboarding', value: 'done' }],
        },
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: `uv run uvicorn openrep.main:app --port ${PWA_BACKEND_PORT}`,
      cwd: '../backend',
      url: `http://localhost:${PWA_BACKEND_PORT}/api/health`,
      // Never adopt a foreign server, same rationale as the main config.
      reuseExistingServer: false,
      env: {
        // Shared throwaway DB with the main suite — see header comment for
        // why that's safe for this GET-only spec.
        OPENREP_DATABASE_PATH: `${process.cwd()}/.tmp/e2e.db`,
      },
      stdout: 'pipe',
    },
    {
      // `build` (not `dev`) so vite-plugin-pwa's injectManifest pipeline
      // actually runs and emits dist/sw.js + dist/manifest.webmanifest, then
      // `preview` serves that real production build. --strictPort: without
      // it Vite silently walks to the next free port while Playwright keeps
      // waiting on PWA_FRONTEND_PORT.
      command: `pnpm --dir ../frontend build && pnpm --dir ../frontend preview --port ${PWA_FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${PWA_FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      // The UI calls same-origin /api; vite preview proxies it to the
      // backend using this same env var the dev server proxy reads.
      env: {
        OPENREP_BACKEND_URL: `http://127.0.0.1:${PWA_BACKEND_PORT}`,
      },
      stdout: 'pipe',
    },
  ],
})
