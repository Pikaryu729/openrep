import { expect, test } from '@playwright/test'

test('theme mode and preset persist across reloads', async ({ page }) => {
  await page.goto('/settings')

  await page.getByTestId('mode-dark').click()
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark')

  await page.getByTestId('preset-ocean').click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ocean')

  // The inline boot script in index.html restores both before first paint.
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'ocean')

  await page.getByTestId('mode-light').click()
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light')
})

test('backup export downloads a JSON file', async ({ page }) => {
  await page.goto('/settings')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download backup JSON' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^openrep-backup-.*\.json$/)
})
