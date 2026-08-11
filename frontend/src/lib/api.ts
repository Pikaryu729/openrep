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

export const api = {
  exercises: {
    list: () => request<Exercise[]>('/exercises'),
    create: (data: { name: string; category?: string; notes?: string }) =>
      request<Exercise>('/exercises', { method: 'POST', body: JSON.stringify(data) }),
  },
  workouts: {
    list: () => request<Workout[]>('/workouts'),
    create: (data: { performed_on: string; notes?: string }) =>
      request<Workout>('/workouts', { method: 'POST', body: JSON.stringify(data) }),
  },
  sets: {
    listByWorkout: (workoutId: number) =>
      request<SetEntry[]>(`/sets?workout_id=${workoutId}`),
    create: (data: {
      workout_id: number
      exercise_id: number
      weight_kg: number
      reps: number
      rpe?: number
    }) => request<SetEntry>('/sets', { method: 'POST', body: JSON.stringify(data) }),
  },
  analytics: {
    volumeByDay: () => request<VolumeByDay[]>('/analytics/volume'),
  },
}
