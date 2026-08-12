import { describe, expect, it } from 'vitest'
import type { SetHistoryPoint } from '@/lib/api'
import { toSessionPoints } from './ExerciseProgressChart'

const point = (
  performed_on: string,
  weight_kg: number,
  reps: number,
  estimated_1rm_kg: number,
): SetHistoryPoint => ({ performed_on, weight_kg, reps, rpe: null, estimated_1rm_kg })

describe('toSessionPoints', () => {
  it('collapses each session to its heaviest set and best estimated 1RM', () => {
    const points = toSessionPoints(
      [
        point('2026-08-01', 100, 5, 116.67),
        point('2026-08-01', 110, 1, 110),
        point('2026-08-08', 105, 5, 122.5),
      ],
      'metric',
    )

    expect(points).toEqual([
      { performed_on: '2026-08-01', top_weight: 110, best_e1rm: 116.67 },
      { performed_on: '2026-08-08', top_weight: 105, best_e1rm: 122.5 },
    ])
  })

  it('sorts sessions chronologically regardless of API order', () => {
    const points = toSessionPoints(
      [point('2026-08-08', 105, 5, 122.5), point('2026-08-01', 100, 5, 116.67)],
      'metric',
    )
    expect(points.map((p) => p.performed_on)).toEqual(['2026-08-01', '2026-08-08'])
  })

  it('converts to the display unit', () => {
    const [session] = toSessionPoints([point('2026-08-01', 100, 1, 100)], 'imperial')
    expect(session.top_weight).toBeCloseTo(220.5, 1)
    expect(session.best_e1rm).toBeCloseTo(220.5, 1)
  })

  it('returns nothing for an exercise with no history', () => {
    expect(toSessionPoints([], 'metric')).toEqual([])
  })
})
