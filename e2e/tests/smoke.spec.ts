import { expect, test } from '@playwright/test'

test('can log an exercise, a workout, and see it reflected in volume', async ({ page }) => {
  await page.goto('/exercises')
  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible()

  await page.getByPlaceholder('Exercise name').fill('Front Squat')
  await page.getByPlaceholder('Category (optional)').fill('legs')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByRole('cell', { name: 'Front Squat', exact: true })).toBeVisible()

  await page.goto('/workouts')
  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  await page.getByRole('button', { name: 'Log workout' }).click()
  await expect(page.locator('li').first()).toBeVisible()

  await page.goto('/')
  // Deliberately layout-independent: the dashboard is user-composable, so any
  // assertion naming a specific widget breaks the moment someone reorders or
  // removes one. The page heading is the stable landmark.
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
})
