import type { APIRequestContext } from '@playwright/test'

/**
 * Shared fixture builders.
 *
 * Deliberately outside `tests/` (the config's `testDir`): a helper that lived
 * in a spec file would be re-registering that file's `test()` calls into every
 * spec that imported it.
 */

/**
 * One exercise with two sets on one day: 100kg x 5 and 110kg x 3, so the
 * volume is 830kg and the best estimated 1RM is 121kg.
 *
 * Names are suffixed with `stamp` because the e2e database is a persistent
 * throwaway — earlier runs have left their own rows in it.
 */
export async function seedTraining(request: APIRequestContext, stamp: number) {
  const exercise = await request
    .post('/api/exercises', { data: { name: `E2E Squat ${stamp}`, category: `e2e-${stamp}` } })
    .then((response) => response.json())
  const workout = await request
    .post('/api/workouts', { data: { performed_on: '2026-08-10' } })
    .then((response) => response.json())

  for (const [weight_kg, reps] of [
    [100, 5],
    [110, 3],
  ]) {
    await request.post('/api/sets', {
      data: { workout_id: workout.id, exercise_id: exercise.id, weight_kg, reps },
    })
  }

  return { exercise, workout }
}
