import { describe, expect, it } from 'vitest'
import { EQUIPMENT, STARTER_EXERCISES, starterByCategory } from './starterExercises'

const CATEGORIES = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core']

describe('starter exercise library', () => {
  it('has unique names', () => {
    // Seeding relies on this: a 409 must mean "already in the user's
    // database", never "the library itself repeats a name".
    const names = STARTER_EXERCISES.map((exercise) => exercise.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('uses only the known categories and equipment kinds', () => {
    for (const exercise of STARTER_EXERCISES) {
      expect(CATEGORIES).toContain(exercise.category)
      expect(EQUIPMENT).toContain(exercise.equipment)
    }
  })

  it('offers a meaningful library for every equipment answer', () => {
    for (const kind of EQUIPMENT) {
      expect(STARTER_EXERCISES.filter((e) => e.equipment === kind).length).toBeGreaterThanOrEqual(5)
    }
  })

  it('groups every movement by category without losing any', () => {
    const groups = starterByCategory()
    expect([...groups.keys()]).toEqual(CATEGORIES)
    const total = [...groups.values()].reduce((sum, group) => sum + group.length, 0)
    expect(total).toBe(STARTER_EXERCISES.length)
  })
})
