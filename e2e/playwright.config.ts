import { defineConfig, devices } from '@playwright/test'

const FRONTEND_PORT = 5173
const BACKEND_PORT = 8765

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'on-first-retry',
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
      reuseExistingServer: !process.env.CI,
      env: {
        OPENREP_DATABASE_PATH: `${process.cwd()}/.tmp/e2e.db`,
      },
      stdout: 'pipe',
    },
    {
      command: 'pnpm --dir ../frontend dev',
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: !process.env.CI,
      // The UI calls same-origin /api; Vite proxies it to the backend.
      env: {
        OPENREP_BACKEND_URL: `http://127.0.0.1:${BACKEND_PORT}`,
      },
      stdout: 'pipe',
    },
  ],
})
