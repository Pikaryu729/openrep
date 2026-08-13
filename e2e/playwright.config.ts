import { defineConfig, devices } from '@playwright/test'

// Dedicated ports, deliberately NOT the dev-server defaults (5173 / 8765).
// Sharing them meant `reuseExistingServer` would adopt whatever backend was
// already listening — including a dev server opened against the real
// ~/.openrep/openrep.db — and these specs create and delete rows. e2e must
// only ever talk to a server it started itself, against the throwaway DB below.
// Env overrides exist for when the defaults are squatted by another process
// (e.g. a second dev server that walked from 5173 to 5174).
const FRONTEND_PORT = Number(process.env.E2E_FRONTEND_PORT ?? 5174)
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 8766)

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'on-first-retry',
    // Pre-marks onboarding as done so the first-run wizard never takes over
    // the shell mid-spec: browser contexts start with empty localStorage, and
    // the shared throwaway DB can be empty on a fresh checkout, which is
    // exactly the state the wizard triggers on. onboarding.spec.ts opts back
    // out of this to test the wizard itself.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: `http://localhost:${FRONTEND_PORT}`,
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
      command: `uv run uvicorn openrep.main:app --port ${BACKEND_PORT}`,
      cwd: '../backend',
      url: `http://localhost:${BACKEND_PORT}/api/health`,
      // Never adopt a foreign server: the point of the dedicated port above is
      // that this suite always owns its own backend and its own database.
      reuseExistingServer: false,
      env: {
        OPENREP_DATABASE_PATH: `${process.cwd()}/.tmp/e2e.db`,
      },
      stdout: 'pipe',
    },
    {
      // --strictPort: without it Vite silently walks to the next free port
      // while Playwright keeps waiting on FRONTEND_PORT.
      command: `pnpm --dir ../frontend dev --port ${FRONTEND_PORT} --strictPort`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      // The UI calls same-origin /api; Vite proxies it to the backend.
      env: {
        OPENREP_BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}`,
      },
      stdout: 'pipe',
    },
  ],
})
