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

test('a customized token survives reload via the boot script', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Open theme editor' }).click()

  await page.getByLabel('Primary', { exact: true }).fill('#123456')
  await expect(page.locator('html')).toHaveCSS('--accent', '#123456')

  // The real proof is after a reload: this value can only be on the element
  // before first paint if index.html's boot script replayed the persisted vars.
  await page.reload()
  await expect(page.locator('html')).toHaveCSS('--accent', '#123456')

  // And it must reach an actual component, not just sit on <html>. The editor's
  // active tab is painted with bg-primary, which resolves through --accent.
  await page.getByRole('button', { name: 'Open theme editor' }).click()
  await expect(page.getByTestId('edit-mode-light')).toHaveCSS(
    'background-color',
    'rgb(18, 52, 86)',
  )
})

test('the editor warns about a palette that fails contrast', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Open theme editor' }).click()

  await expect(page.getByRole('status', { name: 'Theme warnings' })).toBeHidden()

  await page.getByLabel('Primary', { exact: true }).fill('#fefefe')
  await expect(page.getByRole('status', { name: 'Theme warnings' })).toContainText(
    'below the 4.5:1 minimum',
  )
})

test('pasting a tweakcn theme maps its primary onto the brand accent', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Open theme editor' }).click()
  await page.getByRole('button', { name: 'Import a theme' }).click()

  await page
    .getByLabel('Theme CSS')
    .fill(':root { --primary: oklch(0.55 0.22 264); --accent: #00ff00; }')
  await page.getByRole('button', { name: 'Import', exact: true }).click()

  // Their --accent is the hover wash; it must not land on our brand variable.
  await expect(page.locator('html')).toHaveCSS('--ui-accent', '#00ff00')
  await expect(page.locator('html')).not.toHaveCSS('--accent', '#00ff00')
})

test('units preference persists across reloads', async ({ page }) => {
  await page.goto('/settings')

  await expect(page.getByTestId('unit-metric')).toHaveAttribute('aria-pressed', 'true')

  await page.getByTestId('unit-imperial').click()
  await expect(page.getByTestId('unit-imperial')).toHaveAttribute('aria-pressed', 'true')

  await page.reload()
  await expect(page.getByTestId('unit-imperial')).toHaveAttribute('aria-pressed', 'true')

  // Leave the profile as we found it for other specs.
  await page.getByTestId('unit-metric').click()
})

test('backup export downloads a JSON file', async ({ page }) => {
  await page.goto('/settings')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download backup JSON' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^openrep-backup-.*\.json$/)
})
