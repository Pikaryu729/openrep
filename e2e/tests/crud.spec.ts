import { expect, test } from '@playwright/test'

// The e2e database persists between local runs, so every entity gets a unique
// name and the assertions scope to rows containing it.
test('full CRUD flow across exercises, workouts, and sets', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Squat ${stamp}`
  const renamedExercise = `E2E Bulgarian Lunge ${stamp}`
  const workoutTag = `e2e workout ${stamp}`

  // Create an exercise.
  await page.goto('/exercises')
  await page.getByPlaceholder('Exercise name').fill(exerciseName)
  await page.getByPlaceholder('Category (optional)').fill('legs')
  await page.getByRole('button', { name: 'Add' }).click()
  await expect(page.getByRole('cell', { name: exerciseName })).toBeVisible()

  // Rename it through the edit modal.
  const exerciseRow = page.getByRole('row', { name: new RegExp(exerciseName) })
  await exerciseRow.getByRole('button', { name: 'Edit' }).click()
  const editDialog = page.getByRole('dialog', { name: 'Edit exercise' })
  await editDialog.getByLabel('Name').fill(renamedExercise)
  await editDialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('cell', { name: renamedExercise })).toBeVisible()

  // Log a workout with a unique note and open its detail page.
  await page.goto('/workouts')
  await page.getByPlaceholder('Notes (optional)').fill(workoutTag)
  await page.getByRole('button', { name: 'Log workout' }).click()
  await page.getByText(workoutTag).click()
  await expect(page.getByRole('heading', { name: /Workout ·/ })).toBeVisible()

  // Add two sets.
  await page.getByLabel('Exercise').selectOption({ label: renamedExercise })
  await page.getByLabel('Weight (kg)').fill('100')
  await page.getByLabel('Reps').fill('5')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)

  await page.getByLabel('Weight (kg)').fill('120')
  await page.getByLabel('Reps').fill('3')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(2)

  // Reorder: move the second set (120 kg) to the top.
  await page
    .locator('tbody tr')
    .nth(1)
    .getByRole('button', { name: 'Move set up' })
    .click()
  await expect(page.locator('tbody tr').first()).toContainText('120')

  // Edit the first set's weight (scoped to the row: the add-set form has the same labels).
  const editingRow = page.locator('tbody tr').first()
  await editingRow.getByRole('button', { name: 'Edit' }).click()
  await editingRow.getByLabel('Weight (kg)').fill('130')
  await editingRow.getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('tbody tr').first()).toContainText('130')

  // Delete the second set.
  await page.locator('tbody tr').nth(1).getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)

  // Deleting the exercise while its set exists is blocked with a clear error.
  await page.goto('/exercises')
  const renamedRow = page.getByRole('row', { name: new RegExp(renamedExercise) })
  await renamedRow.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(
    page.getByText('This exercise is used by logged sets and cannot be deleted.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()

  // Delete the workout (cascades its sets).
  await page.goto('/workouts')
  await page.getByText(workoutTag).click()
  await page.getByRole('button', { name: 'Delete workout' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page).toHaveURL(/\/workouts$/)
  await expect(page.getByText(workoutTag)).toBeHidden()

  // Now the exercise is unused and can be deleted.
  await page.goto('/exercises')
  await renamedRow.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('cell', { name: renamedExercise })).toBeHidden()
})
