const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

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
    list: () => request<Workout[]>('/workouts'),
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
  },
  analytics: {
    volumeByDay: () => request<VolumeByDay[]>('/analytics/volume'),
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
