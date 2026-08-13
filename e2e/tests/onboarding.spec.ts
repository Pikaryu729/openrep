import { expect, test } from '@playwright/test'

// Replace the config-level "onboarding already done" state with 'replay',
// which forces the wizard regardless of what the shared e2e DB contains —
// the fresh-database heuristic can't be relied on across specs. Seeding is
// idempotent (the server's 409 on an existing name counts as "already
// existed"), so this spec needs no Date.now() name suffixes.
test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: `http://localhost:${process.env.E2E_FRONTEND_PORT ?? 5174}`,
        localStorage: [{ name: 'openrep.onboarding', value: 'replay' }],
      },
    ],
  },
})

test('walks the wizard: preferences apply live, the library seeds, the flag latches done', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByTestId('onboarding-wizard')).toBeVisible()
  await expect(page.getByRole('heading', { name: /Welcome to/ })).toBeVisible()

  await page.getByRole('button', { name: 'Get started' }).click()
  await page.getByTestId('onboarding-unit-imperial').click()
  await expect(page.getByTestId('onboarding-unit-imperial')).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.getByRole('button', { name: 'Next' }).click()

  await page.getByTestId('onboarding-preset-ocean').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ocean')
  await page.getByRole('button', { name: 'Next' }).click()

  await expect(page.getByRole('heading', { name: 'What do you train with?' })).toBeVisible()
  await page.getByRole('button', { name: /Add \d+ exercises/ }).click()

  await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible()
  await page.getByRole('button', { name: 'Log your first workout' }).click()

  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('openrep.onboarding'))).toBe('done')

  // A full reload with the 'done' flag: the wizard must not come back, and the
  // seeded library must be there.
  await page.goto('/exercises')
  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible()
  await expect(page.getByTestId('onboarding-wizard')).not.toBeVisible()
  await expect(page.getByRole('cell', { name: 'Bench Press', exact: true })).toBeVisible()
})

test('skipping dismisses the wizard for good', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('onboarding-wizard')).toBeVisible()

  await page.getByRole('button', { name: 'Skip for now' }).click()

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('openrep.onboarding'))).toBe('done')
})
