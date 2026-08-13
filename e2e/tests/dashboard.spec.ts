import { expect, test } from '@playwright/test'
import { seedTraining } from '../support/seed'

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

/**
 * Custom-widget placements live here rather than in widgets.spec.ts: they read
 * and write the dashboard singleton, so they need this file's serial mode and
 * its afterEach reset.
 */
test('a saved custom widget can be placed on the dashboard', async ({ page }) => {
  const stamp = Date.now()
  const { exercise } = await seedTraining(page.request, stamp)
  const name = `Dashboard widget ${stamp}`

  const created = await page.request
    .post('/api/widgets', {
      data: {
        name,
        description: null,
        visualization: 'table',
        query: {
          source: 'sets',
          filters: [{ field: 'exercise_id', op: 'eq', value: exercise.id }],
          group_by: 'exercise',
          metrics: [{ key: 'm1', agg: 'sum', field: 'volume', label: 'Tonnage' }],
          sort: { by: 'group', direction: 'asc' },
          limit: null,
          range_days: null,
        },
      },
    })
    .then((response) => response.json())

  try {
    await page.goto('/')
    await page.getByRole('button', { name: 'Edit dashboard' }).click()
    await page.getByRole('button', { name: 'Add widget' }).click()
    await page
      .getByRole('dialog', { name: 'Add widget' })
      .getByRole('button', { name: `Add ${name}` })
      .click()

    // Titled by the user's name for it, and drawing real data: 100x5 + 110x3.
    await expect(page.getByRole('heading', { name })).toBeVisible()
    await expect(page.getByRole('cell', { name: '830', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Edit dashboard' })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('heading', { name })).toBeVisible()
  } finally {
    await page.request.delete(`/api/widgets/${created.id}`)
  }
})

test('deleting a widget leaves its dashboard placement explaining itself', async ({ page }) => {
  const stamp = Date.now()
  const created = await page.request
    .post('/api/widgets', {
      data: {
        name: `Doomed widget ${stamp}`,
        description: null,
        visualization: 'bar',
        query: {
          source: 'sets',
          filters: [],
          group_by: 'week',
          metrics: [{ key: 'm1', agg: 'count', field: null, label: null }],
          sort: { by: 'group', direction: 'asc' },
          limit: null,
          range_days: null,
        },
      },
    })
    .then((response) => response.json())

  await page.request.put('/api/dashboard/config', {
    data: {
      version: 1,
      widgets: [{ id: 'placed', type: 'custom', options: { widget_id: created.id } }],
    },
  })

  await page.goto('/widgets')
  await page.getByRole('button', { name: `Delete Doomed widget ${stamp}` }).click()
  await page
    .getByRole('dialog', { name: `Delete "Doomed widget ${stamp}"?` })
    .getByRole('button', { name: 'Delete' })
    .click()
  await expect(page.getByRole('heading', { name: `Doomed widget ${stamp}` })).toHaveCount(0)

  // The placement survives the delete and says what happened, rather than
  // erroring or quietly rendering an empty chart.
  await page.goto('/')
  await expect(page.getByText(/That widget was deleted/)).toBeVisible()
})
