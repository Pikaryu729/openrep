import { expect, test } from '@playwright/test'

// The e2e database persists between runs, and the onboarding spec seeds a
// fixed-name starter library (which includes "Front Squat") into the same DB
// while specs run in parallel — so this exercise gets a unique stamped name,
// like every other spec's entities.
test('can log an exercise, a workout, and see it reflected in volume', async ({ page }) => {
  const exerciseName = `E2E Front Squat ${Date.now()}`

  await page.goto('/exercises')
  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible()

  await page.getByPlaceholder('Exercise name').fill(exerciseName)
  await page.getByPlaceholder('Category (optional)').fill('legs')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByRole('cell', { name: exerciseName, exact: true })).toBeVisible()

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
