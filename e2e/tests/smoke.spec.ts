import { expect, test } from '@playwright/test'

test('can log an exercise, a workout, and see it reflected in volume', async ({ page }) => {
  await page.goto('/exercises')
  await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible()

  await page.getByPlaceholder('Exercise name').fill('Front Squat')
  await page.getByPlaceholder('Category (optional)').fill('legs')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByText('Front Squat')).toBeVisible()

  await page.goto('/workouts')
  await expect(page.getByRole('heading', { name: 'Workouts' })).toBeVisible()
  await page.getByRole('button', { name: 'Log workout' }).click()
  await expect(page.locator('li').first()).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Training volume' })).toBeVisible()
})
