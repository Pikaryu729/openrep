import type { Exercise } from '@/lib/api'

export const DASHBOARD_VERSION = 1
export const MAX_WIDGETS = 24

/** Ranges the UI offers. null means all history. */
export type RangeDays = 30 | 90 | 365 | null
const RANGE_CHOICES: RangeDays[] = [30, 90, 365, null]

export const STAT_METRICS = ['sessions', 'sets', 'volume', 'last_session'] as const
export type StatMetric = (typeof STAT_METRICS)[number]

export interface StatTilesOptions {
  metrics: StatMetric[]
}
export interface VolumeOptions {
  range_days: RangeDays
}
export interface RecordsOptions {
  limit: number
}
export interface ProgressOptions {
  exercise_id: number | null
}
export interface RecentOptions {
  limit: number
  range_days: RangeDays
  exercise_id: number | null
  category: string | null
}
export interface CategoryOptions {
  range_days: RangeDays
  max_categories: number
}

/**
 * A discriminated union rather than a Record<string, Definition<any>>: rendering
 * goes through one `switch` that narrows it, so adding a widget type makes the
 * compiler point at every place that must handle it.
 */
export type WidgetInstance =
  | { id: string; type: 'stat_tiles'; options: StatTilesOptions }
  | { id: string; type: 'volume_chart'; options: VolumeOptions }
  | { id: string; type: 'personal_records'; options: RecordsOptions }
  | { id: string; type: 'exercise_progress'; options: ProgressOptions }
  | { id: string; type: 'recent_workouts'; options: RecentOptions }
  | { id: string; type: 'category_breakdown'; options: CategoryOptions }

export type WidgetType = WidgetInstance['type']
export type OptionsFor<T extends WidgetType> = Extract<WidgetInstance, { type: T }>['options']

// --- per-field normalizers -------------------------------------------------
// Mirrors loadTheme() in lib/theme.ts: never throw, never reject a whole
// object, let each field fall back on its own. That is what makes an option
// added by a newer version harmless here rather than fatal.

function asRecord(raw: unknown): Record<string, unknown> {
  return typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
}

function pickRange(raw: unknown, fallback: RangeDays): RangeDays {
  return RANGE_CHOICES.includes(raw as RangeDays) ? (raw as RangeDays) : fallback
}

function pickInt(raw: unknown, allowed: number[], fallback: number): number {
  return typeof raw === 'number' && allowed.includes(raw) ? raw : fallback
}

function pickId(raw: unknown): number | null {
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : null
}

function pickText(raw: unknown): string | null {
  return typeof raw === 'string' && raw !== '' ? raw : null
}

export interface CatalogEntry<T extends WidgetType> {
  label: string
  description: string
  defaultOptions: OptionsFor<T>
  normalizeOptions: (raw: unknown) => OptionsFor<T>
}

export const WIDGET_CATALOG: { [T in WidgetType]: CatalogEntry<T> } = {
  stat_tiles: {
    label: 'Summary tiles',
    description: 'Sessions, sets, total volume, and the date you last trained.',
    defaultOptions: { metrics: [...STAT_METRICS] },
    normalizeOptions: (raw) => {
      const value = asRecord(raw).metrics
      const metrics = Array.isArray(value)
        ? STAT_METRICS.filter((metric) => value.includes(metric))
        : []
      // Never leave a tile widget with nothing to show.
      return { metrics: metrics.length ? metrics : [...STAT_METRICS] }
    },
  },
  volume_chart: {
    label: 'Training volume',
    description: 'Volume per session as a bar chart.',
    defaultOptions: { range_days: null },
    normalizeOptions: (raw) => ({ range_days: pickRange(asRecord(raw).range_days, null) }),
  },
  personal_records: {
    label: 'Personal records',
    description: 'Your best estimated 1RM per exercise, most recent first.',
    defaultOptions: { limit: 5 },
    normalizeOptions: (raw) => ({ limit: pickInt(asRecord(raw).limit, [3, 5, 10], 5) }),
  },
  exercise_progress: {
    label: 'Exercise progress',
    description: 'Top set and estimated 1RM over time for one exercise.',
    defaultOptions: { exercise_id: null },
    normalizeOptions: (raw) => ({ exercise_id: pickId(asRecord(raw).exercise_id) }),
  },
  recent_workouts: {
    label: 'Recent workouts',
    description: 'Your latest sessions, optionally filtered by exercise or category.',
    defaultOptions: { limit: 5, range_days: null, exercise_id: null, category: null },
    normalizeOptions: (raw) => {
      const options = asRecord(raw)
      return {
        limit: pickInt(options.limit, [5, 10, 20], 5),
        range_days: pickRange(options.range_days, null),
        exercise_id: pickId(options.exercise_id),
        category: pickText(options.category),
      }
    },
  },
  category_breakdown: {
    label: 'Volume by category',
    description: 'Which categories your training volume goes to, ranked.',
    defaultOptions: { range_days: 90, max_categories: 8 },
    normalizeOptions: (raw) => {
      const options = asRecord(raw)
      return {
        range_days: pickRange(options.range_days, 90),
        max_categories: pickInt(options.max_categories, [5, 8, 10], 8),
      }
    },
  },
}

const WIDGET_TYPES = Object.keys(WIDGET_CATALOG) as WidgetType[]

function isWidgetType(value: unknown): value is WidgetType {
  return typeof value === 'string' && WIDGET_TYPES.includes(value as WidgetType)
}

/** Reproduces the pre-widget dashboard, matching the backend's DEFAULT_WIDGETS. */
export const DEFAULT_WIDGETS: WidgetInstance[] = [
  { id: 'stats', type: 'stat_tiles', options: { metrics: [...STAT_METRICS] } },
  { id: 'volume', type: 'volume_chart', options: { range_days: null } },
  { id: 'records', type: 'personal_records', options: { limit: 5 } },
]

let idCounter = 0

/**
 * Deliberately not crypto.randomUUID(): availability under jsdom varies by
 * version, and readable ids keep assertions on the saved payload legible.
 */
export function nextWidgetId(): string {
  idCounter += 1
  return `w-${Date.now().toString(36)}-${idCounter}`
}

function buildWidget(id: string, type: WidgetType, rawOptions: unknown): WidgetInstance {
  const entry = WIDGET_CATALOG[type] as CatalogEntry<WidgetType>
  return { id, type, options: entry.normalizeOptions(rawOptions) } as WidgetInstance
}

export function createWidget(type: WidgetType): WidgetInstance {
  return buildWidget(nextWidgetId(), type, undefined)
}

export interface NormalizeResult {
  widgets: WidgetInstance[]
  /** Entries discarded — almost always widget types from a newer version. */
  dropped: number
}

export function normalizeWidgets(raw: unknown): NormalizeResult {
  if (!Array.isArray(raw)) return { widgets: [], dropped: 0 }

  const widgets: WidgetInstance[] = []
  const seen = new Set<string>()
  let dropped = 0

  for (const entry of raw) {
    const record = asRecord(entry)
    if (!isWidgetType(record.type)) {
      dropped += 1
      continue
    }
    let id = typeof record.id === 'string' && record.id !== '' ? record.id : nextWidgetId()
    // React keys must be unique; a duplicate is re-issued rather than dropped.
    if (seen.has(id)) id = nextWidgetId()
    seen.add(id)
    widgets.push(buildWidget(id, record.type, record.options))
  }

  return { widgets, dropped }
}

/** Stored config → widgets. An unknown version falls back to defaults rather
 * than erroring, so a downgrade still leaves a usable dashboard. */
export function widgetsFromConfig(config: { version: number; widgets: unknown }): NormalizeResult {
  if (config.version !== DASHBOARD_VERSION) return { widgets: [...DEFAULT_WIDGETS], dropped: 0 }
  return normalizeWidgets(config.widgets)
}

// --- portable file form ----------------------------------------------------
// exercise_id is meaningless in another database, so the file references
// exercises by name. Names are unique, which makes the match unambiguous —
// the same semantics backup merge mode uses.

export interface DashboardFile {
  app: string
  kind: string
  version: number
  exported_at: string
  widgets: { id: string; type: string; options: Record<string, unknown> }[]
}

const NAME_KEYED: WidgetType[] = ['exercise_progress', 'recent_workouts']

export function toFileWidgets(
  widgets: WidgetInstance[],
  exercises: Exercise[],
): DashboardFile['widgets'] {
  const nameById = new Map(exercises.map((exercise) => [exercise.id, exercise.name]))
  return widgets.map((widget) => {
    if (!NAME_KEYED.includes(widget.type)) {
      return { id: widget.id, type: widget.type, options: { ...widget.options } }
    }
    const { exercise_id: exerciseId, ...rest } = widget.options as { exercise_id: number | null }
    return {
      id: widget.id,
      type: widget.type,
      // An id that no longer resolves exports as an unconfigured widget rather
      // than a dead number.
      options: { ...rest, exercise_name: exerciseId == null ? null : (nameById.get(exerciseId) ?? null) },
    }
  })
}

export interface FromFileResult extends NormalizeResult {
  /** Exercise names in the file that this library has no match for. */
  unresolved: string[]
}

export function fromFileWidgets(
  raw: DashboardFile['widgets'],
  exercises: Exercise[],
): FromFileResult {
  const idByName = new Map(exercises.map((exercise) => [exercise.name, exercise.id]))
  const unresolved: string[] = []

  const remapped = (Array.isArray(raw) ? raw : []).map((entry) => {
    const record = asRecord(entry)
    if (!NAME_KEYED.includes(record.type as WidgetType)) return record
    const options = asRecord(record.options)
    const name = pickText(options.exercise_name)
    const localId = name == null ? null : (idByName.get(name) ?? null)
    if (name != null && localId == null && !unresolved.includes(name)) unresolved.push(name)
    const { exercise_name: _dropped, ...rest } = options
    return { ...record, options: { ...rest, exercise_id: localId } }
  })

  return { ...normalizeWidgets(remapped), unresolved }
}

export function parseDashboardFile(raw: unknown): DashboardFile | null {
  const record = asRecord(raw)
  if (record.app !== 'openrep' || record.kind !== 'dashboard') return null
  if (record.version !== DASHBOARD_VERSION) return null
  if (!Array.isArray(record.widgets)) return null
  return record as unknown as DashboardFile
}

export function buildDashboardFile(
  widgets: WidgetInstance[],
  exercises: Exercise[],
): DashboardFile {
  return {
    app: 'openrep',
    kind: 'dashboard',
    version: DASHBOARD_VERSION,
    exported_at: new Date().toISOString(),
    widgets: toFileWidgets(widgets, exercises),
  }
}

/** Swap a widget with its neighbour. Out-of-range moves are a no-op. */
export function moveWidget(widgets: WidgetInstance[], index: number, delta: -1 | 1): WidgetInstance[] {
  const target = index + delta
  if (index < 0 || index >= widgets.length || target < 0 || target >= widgets.length) {
    return widgets
  }
  const next = [...widgets]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** The payload shape the API expects. */
export function toConfigPayload(widgets: WidgetInstance[]) {
  return {
    version: DASHBOARD_VERSION,
    widgets: widgets.map((widget) => ({
      id: widget.id,
      type: widget.type,
      options: { ...widget.options } as Record<string, unknown>,
    })),
  }
}
