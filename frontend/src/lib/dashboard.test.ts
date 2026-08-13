import { describe, expect, it } from 'vitest'
import type { Exercise } from './api'
import {
  DEFAULT_WIDGETS,
  buildDashboardFile,
  createWidget,
  fromFileWidgets,
  moveWidget,
  nextWidgetId,
  normalizeWidgets,
  parseDashboardFile,
  toConfigPayload,
  toFileWidgets,
  widgetsFromConfig,
  type WidgetInstance,
} from './dashboard'

const exercise = (id: number, name: string): Exercise => ({
  id,
  name,
  category: 'legs',
  notes: null,
})

const EXERCISES = [exercise(12, 'Back Squat'), exercise(3, 'Overhead Press')]
const CUSTOM_WIDGETS = [
  { id: 7, name: 'Weekly tonnage' },
  { id: 9, name: 'RPE drift' },
]
/** Both name-keyed sources the file form resolves against. */
const LIBRARY = { exercises: EXERCISES, customWidgets: CUSTOM_WIDGETS }

describe('normalizeWidgets', () => {
  it('keeps known widget types and drops unknown ones', () => {
    const result = normalizeWidgets([
      { id: 'a', type: 'volume_chart', options: { range_days: 90 } },
      { id: 'b', type: 'hologram', options: {} },
      { id: 'c', type: 'personal_records', options: { limit: 10 } },
    ])

    expect(result.widgets.map((w) => w.id)).toEqual(['a', 'c'])
    expect(result.dropped).toBe(1)
  })

  it('returns nothing for a non-array', () => {
    expect(normalizeWidgets(null)).toEqual({ widgets: [], dropped: 0 })
    expect(normalizeWidgets('nope')).toEqual({ widgets: [], dropped: 0 })
  })

  it('re-ids duplicates so React keys stay unique', () => {
    const result = normalizeWidgets([
      { id: 'dup', type: 'volume_chart', options: {} },
      { id: 'dup', type: 'personal_records', options: {} },
    ])

    expect(result.widgets).toHaveLength(2)
    expect(result.widgets[0].id).not.toBe(result.widgets[1].id)
  })

  it('falls back per field instead of rejecting the whole widget', () => {
    const [widget] = normalizeWidgets([
      { id: 'a', type: 'recent_workouts', options: { limit: 999, category: 'legs', bogus: 1 } },
    ]).widgets

    expect(widget.options).toEqual({
      limit: 5, // 999 is not an offered choice
      range_days: null,
      exercise_id: null,
      category: 'legs', // valid field survives
    })
  })

  it('never leaves the stat tiles with nothing to show', () => {
    const [widget] = normalizeWidgets([
      { id: 'a', type: 'stat_tiles', options: { metrics: ['nonsense'] } },
    ]).widgets
    expect(widget.options).toEqual({ metrics: ['sessions', 'sets', 'volume', 'last_session'] })
  })
})

describe('widgetsFromConfig', () => {
  it('falls back to defaults on an unknown version', () => {
    const result = widgetsFromConfig({ version: 99, widgets: [{ id: 'a', type: 'volume_chart' }] })
    expect(result.widgets).toEqual(DEFAULT_WIDGETS)
  })

  it('normalizes a current-version config', () => {
    const result = widgetsFromConfig({
      version: 1,
      widgets: [{ id: 'a', type: 'volume_chart', options: {} }],
    })
    expect(result.widgets.map((w) => w.type)).toEqual(['volume_chart'])
  })
})

describe('parseDashboardFile', () => {
  it('rejects anything that is not an OpenRep v1 dashboard', () => {
    expect(parseDashboardFile(null)).toBeNull()
    expect(parseDashboardFile({ app: 'other', kind: 'dashboard', version: 1, widgets: [] })).toBeNull()
    // A backup file must not be mistaken for a layout.
    expect(parseDashboardFile({ app: 'openrep', kind: 'backup', version: 1, widgets: [] })).toBeNull()
    expect(parseDashboardFile({ app: 'openrep', kind: 'dashboard', version: 2, widgets: [] })).toBeNull()
  })

  it('accepts a well-formed file', () => {
    const file = { app: 'openrep', kind: 'dashboard', version: 1, exported_at: 'x', widgets: [] }
    expect(parseDashboardFile(file)).not.toBeNull()
  })
})

describe('portable exercise references', () => {
  const pinned: WidgetInstance[] = [
    { id: 'a', type: 'exercise_progress', options: { exercise_id: 12 } },
    { id: 'b', type: 'volume_chart', options: { range_days: 90 } },
  ]

  it('exports exercises by name, never by id', () => {
    const [progress, volume] = toFileWidgets(pinned, LIBRARY)
    expect(progress.options).toEqual({ exercise_name: 'Back Squat' })
    expect(progress.options.exercise_id).toBeUndefined()
    // Widgets without an exercise reference pass through untouched.
    expect(volume.options).toEqual({ range_days: 90 })
  })

  it('exports an unresolvable id as unconfigured rather than a dead number', () => {
    const [progress] = toFileWidgets(
      [{ id: 'a', type: 'exercise_progress', options: { exercise_id: 999 } }],
      LIBRARY,
    )
    expect(progress.options).toEqual({ exercise_name: null })
  })

  it('resolves names against the local library, not the exporter ids', () => {
    // The file says "Back Squat"; locally that lift is id 7, not 12.
    const local = { exercises: [exercise(7, 'Back Squat')], customWidgets: [] }
    const result = fromFileWidgets(
      [{ id: 'a', type: 'exercise_progress', options: { exercise_name: 'Back Squat' } }],
      local,
    )

    expect(result.widgets[0].options).toEqual({ exercise_id: 7 })
    expect(result.unresolved).toEqual([])
  })

  it('reports names the library has no match for, keeping the widget', () => {
    const result = fromFileWidgets(
      [{ id: 'a', type: 'exercise_progress', options: { exercise_name: 'Zercher Squat' } }],
      LIBRARY,
    )

    expect(result.unresolved).toEqual(['Zercher Squat'])
    // Kept but unconfigured — better than silently vanishing.
    expect(result.widgets).toHaveLength(1)
    expect(result.widgets[0].options).toEqual({ exercise_id: null })
  })

  it('round-trips through a file when the library matches', () => {
    const file = buildDashboardFile(pinned, LIBRARY)
    const back = fromFileWidgets(file.widgets, LIBRARY)
    expect(back.widgets).toEqual(pinned)
    expect(back.unresolved).toEqual([])
  })

  it('carries the recent-workouts exercise filter across too', () => {
    const widgets: WidgetInstance[] = [
      {
        id: 'a',
        type: 'recent_workouts',
        options: { limit: 10, range_days: 90, exercise_id: 3, category: 'legs' },
      },
    ]
    const file = buildDashboardFile(widgets, LIBRARY)
    expect(file.widgets[0].options.exercise_name).toBe('Overhead Press')
    expect(fromFileWidgets(file.widgets, LIBRARY).widgets).toEqual(widgets)
  })

  describe('custom widget references', () => {
    const placed: WidgetInstance[] = [{ id: 'a', type: 'custom', options: { widget_id: 7 } }]

    it('exports a custom placement by the widget name', () => {
      const [entry] = toFileWidgets(placed, LIBRARY)
      expect(entry.options).toEqual({ widget_name: 'Weekly tonnage' })
      expect(entry.options.widget_id).toBeUndefined()
    })

    it('resolves the name against this database, not the exporter ids', () => {
      const local = { exercises: [], customWidgets: [{ id: 21, name: 'Weekly tonnage' }] }
      const file = buildDashboardFile(placed, LIBRARY)
      expect(fromFileWidgets(file.widgets, local).widgets[0].options).toEqual({ widget_id: 21 })
    })

    it('reports a widget this database does not have, keeping the placement', () => {
      const result = fromFileWidgets(
        [{ id: 'a', type: 'custom', options: { widget_name: 'Bar speed' } }],
        LIBRARY,
      )
      expect(result.unresolved).toEqual(['Bar speed'])
      expect(result.widgets[0].options).toEqual({ widget_id: null })
    })

    it('round-trips alongside exercise references', () => {
      const mixed: WidgetInstance[] = [
        ...placed,
        { id: 'b', type: 'exercise_progress', options: { exercise_id: 12 } },
      ]
      const file = buildDashboardFile(mixed, LIBRARY)
      expect(fromFileWidgets(file.widgets, LIBRARY).widgets).toEqual(mixed)
    })
  })
})

describe('moveWidget', () => {
  const widgets = normalizeWidgets([
    { id: 'a', type: 'volume_chart', options: {} },
    { id: 'b', type: 'personal_records', options: {} },
    { id: 'c', type: 'stat_tiles', options: {} },
  ]).widgets

  it('swaps with the neighbour', () => {
    expect(moveWidget(widgets, 1, -1).map((w) => w.id)).toEqual(['b', 'a', 'c'])
    expect(moveWidget(widgets, 1, 1).map((w) => w.id)).toEqual(['a', 'c', 'b'])
  })

  it('is a no-op at the ends', () => {
    expect(moveWidget(widgets, 0, -1)).toBe(widgets)
    expect(moveWidget(widgets, 2, 1)).toBe(widgets)
  })
})

describe('ids and payload', () => {
  it('issues unique ids', () => {
    expect(nextWidgetId()).not.toBe(nextWidgetId())
  })

  it('creates a widget with its catalog defaults', () => {
    expect(createWidget('category_breakdown').options).toEqual({
      range_days: 90,
      max_categories: 8,
    })
  })

  it('builds the API payload with local ids intact', () => {
    const payload = toConfigPayload([
      { id: 'a', type: 'exercise_progress', options: { exercise_id: 12 } },
    ])
    expect(payload).toEqual({
      version: 1,
      widgets: [{ id: 'a', type: 'exercise_progress', options: { exercise_id: 12 } }],
    })
  })
})
