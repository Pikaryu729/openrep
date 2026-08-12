import { expect, test } from '@playwright/test'

/**
 * The dashboard config is a SINGLETON, so unlike every other spec here it
 * cannot be isolated with unique Date.now() names. Each test therefore restores
 * the default layout before it finishes, and the suite's other specs avoid
 * asserting on dashboard widgets by name.
 */
async function resetLayout(page: import('@playwright/test').Page) {
  await page.request.put('/api/dashboard/config', {
    data: {
      version: 1,
      widgets: [
        { id: 'stats', type: 'stat_tiles', options: {} },
        { id: 'volume', type: 'volume_chart', options: { range_days: null } },
        { id: 'records', type: 'personal_records', options: { limit: 5 } },
      ],
    },
  })
}

test.afterEach(async ({ page }) => {
  await resetLayout(page)
})

test.describe.configure({ mode: 'serial' })

test('a saved layout survives a reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit dashboard' }).click()
  await page.getByRole('button', { name: 'Add widget' }).click()
  const dialog = page.getByRole('dialog', { name: 'Add widget' })
  await dialog.getByRole('button', { name: 'Add Volume by category' }).click()

  await expect(page.getByRole('heading', { name: 'Volume by category' })).toBeVisible()
  await page.getByRole('button', { name: 'Save' }).click()

  // Back to view mode, and the widget is still there after a full reload —
  // which is the only thing that proves it reached the backend.
  await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Volume by category' })).toBeVisible()
})

test('cancelling discards changes', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Edit dashboard' }).click()

  await page.getByRole('button', { name: 'Add widget' }).click()
  await page
    .getByRole('dialog', { name: 'Add widget' })
    .getByRole('button', { name: 'Add Recent workouts' })
    .click()
  await expect(page.getByRole('heading', { name: 'Recent workouts' })).toBeVisible()

  await page.getByRole('button', { name: 'Cancel' }).click()
  await page
    .getByRole('dialog', { name: 'Discard dashboard changes?' })
    .getByRole('button', { name: 'Discard' })
    .click()

  await expect(page.getByRole('heading', { name: 'Recent workouts' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Recent workouts' })).toHaveCount(0)
})

test('exports the layout as a JSON file', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Edit dashboard' }).click()

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export layout' }).click()
  const file = await download

  expect(file.suggestedFilename()).toMatch(/^openrep-dashboard-\d{4}-\d{2}-\d{2}\.json$/)
})
