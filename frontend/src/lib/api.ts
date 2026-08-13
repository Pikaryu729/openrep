// Same-origin by default: the packaged app serves the API and this UI from one
// process, and `pnpm dev` proxies /api to the backend (see vite.config.ts).
// Override only to point at a backend elsewhere — include the /api suffix.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    throw new ApiError(response.status, await response.text())
  }
  if (response.status === 204) {
    return undefined as T
  }
  return response.json() as Promise<T>
}

/** Drops undefined/null params so callers can pass optional filters directly. */
function queryString(params: Record<string, string | number | null | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `?${query}` : ''
}

export interface Exercise {
  id: number
  name: string
  category: string
  notes: string | null
}

export interface Workout {
  id: number
  performed_on: string
  notes: string | null
  created_at: string
}

export interface SetEntry {
  id: number
  workout_id: number
  exercise_id: number
  weight_kg: number
  reps: number
  rpe: number | null
  set_order: number
}

export interface VolumeByDay {
  performed_on: string
  total_volume_kg: number
  total_sets: number
}

export interface SetHistoryPoint {
  performed_on: string
  weight_kg: number
  reps: number
  rpe: number | null
  estimated_1rm_kg: number
}

export interface ExercisePersonalRecords {
  exercise_id: number
  max_weight_kg: number | null
  max_weight_achieved_on: string | null
  max_estimated_1rm_kg: number | null
  max_estimated_1rm_achieved_on: string | null
  max_volume_in_a_workout_kg: number | null
  max_volume_achieved_on: string | null
}

export interface RecentPersonalRecord {
  exercise_id: number
  exercise_name: string
  max_estimated_1rm_kg: number
  achieved_on: string
}

export interface CategoryVolume {
  category: string
  total_volume_kg: number
  total_sets: number
  exercise_count: number
}

export interface DateRange {
  start?: string | null
  end?: string | null
}

export interface WorkoutFilters extends DateRange {
  limit?: number | null
  exercise_id?: number | null
  category?: string | null
}

/** One widget as stored. `options` is per-type; see lib/dashboard.ts. */
export interface DashboardWidgetPayload {
  id: string
  type: string
  options: Record<string, unknown>
}

export interface DashboardConfig {
  version: number
  widgets: DashboardWidgetPayload[]
  /** null means the layout has never been customized. */
  updated_at: string | null
}

// --- user-created widgets --------------------------------------------------
// The query language mirrors backend/openrep/schemas/widget_query.py. The
// *catalog* (which fields exist, which operators each one takes) is fetched
// from /widgets/fields rather than duplicated here: the server executes these
// queries, so it owns the whitelist, and a second copy would drift.

export type FilterOp =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'contains'
  | 'is_null'
  | 'not_null'
export type Aggregate = 'sum' | 'avg' | 'min' | 'max' | 'count' | 'count_distinct'
export type GroupBy =
  | 'none'
  | 'day'
  | 'week'
  | 'month'
  | 'weekday'
  | 'exercise'
  | 'category'
  | 'rep_range'
export type Visualization = 'bar' | 'line' | 'table' | 'stat'
export type QueryUnit = 'weight' | 'reps' | 'rpe' | 'count' | 'none'
export type FieldKind = 'number' | 'text' | 'date'

export interface QueryFilter {
  field: string
  op: FilterOp
  /** A scalar, or an array when `op` is `in`. Null for the blank checks. */
  value: string | number | (string | number)[] | null
}

export interface QueryMetric {
  key: string
  agg: Aggregate
  field: string | null
  label: string | null
}

export interface QuerySort {
  by: string
  direction: 'asc' | 'desc'
}

export interface WidgetQuery {
  source: 'sets'
  filters: QueryFilter[]
  group_by: GroupBy
  metrics: QueryMetric[]
  sort: QuerySort
  limit: number | null
  range_days: number | null
}

export interface QueryColumn {
  key: string
  label: string
  kind: 'group' | 'metric'
  unit: QueryUnit
}

export interface QueryResultRow {
  group: string | null
  [metricKey: string]: string | number | null
}

export interface QueryResult {
  columns: QueryColumn[]
  rows: QueryResultRow[]
  group_by: GroupBy
  truncated: boolean
}

export interface CustomWidget {
  id: number
  name: string
  description: string | null
  visualization: Visualization
  query: WidgetQuery
  created_at: string
  updated_at: string
}

export interface CustomWidgetInput {
  name: string
  description: string | null
  visualization: Visualization
  query: WidgetQuery
}

export interface QueryFieldInfo {
  key: string
  label: string
  kind: FieldKind
  unit: QueryUnit
  aggregatable: boolean
  description: string
  ops: FilterOp[]
  aggregates: Aggregate[]
}

export interface QueryChoice {
  value: string
  label: string
}

export interface QueryCatalog {
  fields: QueryFieldInfo[]
  group_by: QueryChoice[]
  aggregates: QueryChoice[]
  visualizations: QueryChoice[]
  range_days: number[]
  rep_ranges: string[]
  max_filters: number
  max_metrics: number
  max_rows: number
}

export interface BackupDocument {
  app: string
  version: number
  exported_at: string
  exercises: Exercise[]
  workouts: Workout[]
  sets: SetEntry[]
}

export interface BackupImportSummary {
  mode: string
  exercises_created: number
  exercises_matched: number
  workouts_created: number
  sets_created: number
}

export const api = {
  exercises: {
    list: () => request<Exercise[]>('/exercises'),
    get: (id: number) => request<Exercise>(`/exercises/${id}`),
    create: (data: { name: string; category?: string; notes?: string }) =>
      request<Exercise>('/exercises', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { name?: string; category?: string; notes?: string | null }) =>
      request<Exercise>(`/exercises/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/exercises/${id}`, { method: 'DELETE' }),
  },
  workouts: {
    // Callers must wrap this in an arrow when used as a TanStack queryFn:
    // a bare reference receives the QueryFunctionContext as `filters` and
    // serializes it into the query string.
    list: (filters: WorkoutFilters = {}) =>
      request<Workout[]>(`/workouts${queryString({ ...filters })}`),
    get: (id: number) => request<Workout>(`/workouts/${id}`),
    create: (data: { performed_on: string; notes?: string }) =>
      request<Workout>('/workouts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: { performed_on?: string; notes?: string | null }) =>
      request<Workout>(`/workouts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/workouts/${id}`, { method: 'DELETE' }),
  },
  sets: {
    listByWorkout: (workoutId: number) =>
      request<SetEntry[]>(`/sets?workout_id=${workoutId}`),
    get: (id: number) => request<SetEntry>(`/sets/${id}`),
    create: (data: {
      workout_id: number
      exercise_id: number
      weight_kg: number
      reps: number
      rpe?: number
      set_order?: number
    }) => request<SetEntry>('/sets', { method: 'POST', body: JSON.stringify(data) }),
    update: (
      id: number,
      data: { weight_kg?: number; reps?: number; rpe?: number | null; set_order?: number },
    ) => request<SetEntry>(`/sets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/sets/${id}`, { method: 'DELETE' }),
    // One request, one transaction: two separate PATCHes leave the rows
    // briefly sharing a set_order, and a refetch in that window reorders them
    // under the user's cursor.
    reorder: (updates: { id: number; set_order: number }[]) =>
      request<SetEntry[]>('/sets/reorder', { method: 'PATCH', body: JSON.stringify(updates) }),
  },
  analytics: {
    volumeByDay: (range: DateRange = {}) =>
      request<VolumeByDay[]>(`/analytics/volume${queryString({ ...range })}`),
    volumeByCategory: (range: DateRange = {}) =>
      request<CategoryVolume[]>(`/analytics/volume-by-category${queryString({ ...range })}`),
    exerciseHistory: (exerciseId: number) =>
      request<SetHistoryPoint[]>(`/analytics/exercises/${exerciseId}/history`),
    exercisePersonalRecords: (exerciseId: number) =>
      request<ExercisePersonalRecords>(`/analytics/exercises/${exerciseId}/personal-records`),
    recentPersonalRecords: (limit = 5) =>
      request<RecentPersonalRecord[]>(`/analytics/personal-records?limit=${limit}`),
  },
  dashboard: {
    getConfig: () => request<DashboardConfig>('/dashboard/config'),
    saveConfig: (config: { version: number; widgets: DashboardWidgetPayload[] }) =>
      request<DashboardConfig>('/dashboard/config', {
        method: 'PUT',
        body: JSON.stringify(config),
      }),
  },
  widgets: {
    /** The query language itself. Cached hard by callers — it only changes
     * when the server does. */
    catalog: () => request<QueryCatalog>('/widgets/fields'),
    list: () => request<CustomWidget[]>('/widgets'),
    get: (id: number) => request<CustomWidget>(`/widgets/${id}`),
    create: (data: CustomWidgetInput) =>
      request<CustomWidget>('/widgets', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<CustomWidgetInput>) =>
      request<CustomWidget>(`/widgets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/widgets/${id}`, { method: 'DELETE' }),
    // `range` resolves the query's own range_days: the server never decides
    // what "today" is (see lib/widgetQuery.ts).
    data: (id: number, range: DateRange = {}) =>
      request<QueryResult>(`/widgets/${id}/data${queryString({ ...range })}`),
    preview: (query: WidgetQuery, range: DateRange = {}) =>
      request<QueryResult>(`/widgets/preview${queryString({ ...range })}`, {
        method: 'POST',
        body: JSON.stringify(query),
      }),
  },
  backup: {
    exportData: () => request<BackupDocument>('/backup/export'),
    importData: (data: { mode: 'merge' | 'replace'; data: BackupDocument }) =>
      request<BackupImportSummary>('/backup/import', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
}
