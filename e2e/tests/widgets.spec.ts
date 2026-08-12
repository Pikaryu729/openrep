import { expect, test } from '@playwright/test'
import { seedTraining } from '../support/seed'

/**
 * Custom widgets against the real stack: the query is built in the browser,
 * executed by the backend against SQLite, and drawn from the result.
 *
 * Widget names are unique in the database, so every test suffixes with
 * Date.now() the way the CRUD specs do.
 *
 * Nothing here touches the dashboard. That config is a singleton shared across
 * workers, and `dashboard.spec.ts` owns it — the two tests that place a custom
 * widget on a dashboard live there, inside its serial block.
 */

test('builds a widget, previews it, and saves it', async ({ page }) => {
  const stamp = Date.now()
  await seedTraining(page.request, stamp)
  const name = `Weekly tonnage ${stamp}`

  await page.goto('/widgets')
  await page.getByRole('button', { name: /Create( your first)? widget/ }).click()

  await expect(page.getByRole('heading', { name: 'Create a widget' })).toBeVisible()
  await page.getByLabel('Widget name').fill(name)

  // The default query already answers something, so a preview is on screen
  // before any choice is made.
  await expect(page.getByText('Total volume by week · last 90 days')).toBeVisible()

  await page.getByLabel('Group by').selectOption('exercise')
  await page.getByLabel('Time range').selectOption('')
  await page.getByLabel('Visualization').selectOption('table')

  // Scoped to this run's row: the throwaway DB is persistent, so earlier runs
  // have left their own lifts (and their own totals) in the table.
  const row = page.getByRole('row').filter({ hasText: `E2E Squat ${stamp}` })
  // 100x5 + 110x3 = 830kg.
  await expect(row.getByRole('cell', { name: '830', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Create widget' }).click()

  // Lands on the saved widget, and it survives a reload — which is the only
  // thing that proves it reached the database.
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Widget name')).toHaveValue(name)
})

test('filters narrow the result', async ({ page }) => {
  const stamp = Date.now()
  await seedTraining(page.request, stamp)

  await page.goto('/widgets/new')
  await page.getByLabel('Widget name').fill(`Heavy sets ${stamp}`)
  await page.getByLabel('Group by').selectOption('exercise')
  await page.getByLabel('Time range').selectOption('')
  await page.getByLabel('Visualization').selectOption('table')

  const row = page.getByRole('row').filter({ hasText: `E2E Squat ${stamp}` })
  await expect(row.getByRole('cell', { name: '830', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Add filter' }).click()
  await page.getByLabel('Field').selectOption('reps')
  await page.getByLabel('Condition').selectOption('gte')
  await page.getByLabel('Value').fill('5')

  // Only the 100x5 set survives, so this lift's total drops to 500.
  await expect(row.getByRole('cell', { name: '500', exact: true })).toBeVisible()
  await expect(row.getByRole('cell', { name: '830', exact: true })).toHaveCount(0)
})
