import { defineConfig, devices } from '@playwright/test'
// Port resolution and origin derivation live in one module so this config and
// specs that write their own `storageState` (onboarding.spec.ts) can never
// disagree — see support/ports.ts for the dedicated-ports rationale.
import { BACKEND_PORT, FRONTEND_ORIGIN, FRONTEND_PORT } from './support/ports'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: FRONTEND_ORIGIN,
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
          origin: FRONTEND_ORIGIN,
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
