import { describe, expect, it } from 'vitest'
import type { CategoryVolume } from '@/lib/api'
import { OTHER_CATEGORY, toCategoryRows } from './CategoryVolumeChart'

const entry = (category: string, volume: number, sets = 1): CategoryVolume => ({
  category,
  total_volume_kg: volume,
  total_sets: sets,
  exercise_count: 1,
})

describe('toCategoryRows', () => {
  it('ranks categories by volume', () => {
    const rows = toCategoryRows(
      [entry('push', 500), entry('legs', 1200), entry('back', 800)],
      'metric',
      8,
    )
    expect(rows.map((row) => row.category)).toEqual(['legs', 'back', 'push'])
  })

  it('folds the tail into one Other bucket, always last', () => {
    const rows = toCategoryRows(
      [entry('legs', 1000, 4), entry('back', 900, 3), entry('push', 50, 2), entry('arms', 40, 1)],
      'metric',
      2,
    )

    expect(rows.map((row) => row.category)).toEqual(['legs', 'back', OTHER_CATEGORY])
    const other = rows[2]
    expect(other.volume).toBe(90)
    expect(other.sets).toBe(3)
    expect(other.isOther).toBe(true)
  })

  it('keeps Other last even when it would outrank the head', () => {
    // Other is a bucket, not a rank — sorting it by size would mislead.
    const rows = toCategoryRows(
      [entry('legs', 100), entry('a', 90), entry('b', 90), entry('c', 90)],
      'metric',
      1,
    )
    expect(rows.map((row) => row.category)).toEqual(['legs', OTHER_CATEGORY])
    expect(rows[1].volume).toBe(270)
  })

  it('adds no Other row when everything fits', () => {
    const rows = toCategoryRows([entry('legs', 100), entry('push', 50)], 'metric', 8)
    expect(rows).toHaveLength(2)
    expect(rows.some((row) => row.isOther)).toBe(false)
  })

  it('converts to the display unit', () => {
    const [row] = toCategoryRows([entry('legs', 100)], 'imperial', 8)
    expect(row.volume).toBeCloseTo(220.5, 1)
  })

  it('returns nothing for no data', () => {
    expect(toCategoryRows([], 'metric', 8)).toEqual([])
  })
})
