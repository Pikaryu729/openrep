/**
 * The curated starter library the onboarding wizard offers to seed
 * (ROADMAP §3). Names must be unique — seeding treats the server's 409 on a
 * duplicate name as "already exists", which is what makes re-running the
 * wizard idempotent. `equipment` only drives selection in the wizard; it is
 * never sent to the API. Categories are the same lowercase free text a user
 * would type on the exercises page.
 */

export const EQUIPMENT = ['barbell', 'dumbbell', 'machine', 'bodyweight'] as const

export type Equipment = (typeof EQUIPMENT)[number]

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  machine: 'Machines & cables',
  bodyweight: 'Bodyweight',
}

export interface StarterExercise {
  name: string
  category: string
  equipment: Equipment
}

export const STARTER_EXERCISES: StarterExercise[] = [
  // chest
  { name: 'Bench Press', category: 'chest', equipment: 'barbell' },
  { name: 'Incline Bench Press', category: 'chest', equipment: 'barbell' },
  { name: 'Dumbbell Bench Press', category: 'chest', equipment: 'dumbbell' },
  { name: 'Incline Dumbbell Press', category: 'chest', equipment: 'dumbbell' },
  { name: 'Dumbbell Fly', category: 'chest', equipment: 'dumbbell' },
  { name: 'Cable Fly', category: 'chest', equipment: 'machine' },
  { name: 'Machine Chest Press', category: 'chest', equipment: 'machine' },
  { name: 'Push-Up', category: 'chest', equipment: 'bodyweight' },
  // back
  { name: 'Deadlift', category: 'back', equipment: 'barbell' },
  { name: 'Barbell Row', category: 'back', equipment: 'barbell' },
  { name: 'Dumbbell Row', category: 'back', equipment: 'dumbbell' },
  { name: 'Lat Pulldown', category: 'back', equipment: 'machine' },
  { name: 'Seated Cable Row', category: 'back', equipment: 'machine' },
  { name: 'Pull-Up', category: 'back', equipment: 'bodyweight' },
  { name: 'Chin-Up', category: 'back', equipment: 'bodyweight' },
  { name: 'Back Extension', category: 'back', equipment: 'bodyweight' },
  // legs
  { name: 'Back Squat', category: 'legs', equipment: 'barbell' },
  { name: 'Front Squat', category: 'legs', equipment: 'barbell' },
  { name: 'Romanian Deadlift', category: 'legs', equipment: 'barbell' },
  { name: 'Hip Thrust', category: 'legs', equipment: 'barbell' },
  { name: 'Goblet Squat', category: 'legs', equipment: 'dumbbell' },
  { name: 'Bulgarian Split Squat', category: 'legs', equipment: 'dumbbell' },
  { name: 'Walking Lunge', category: 'legs', equipment: 'dumbbell' },
  { name: 'Leg Press', category: 'legs', equipment: 'machine' },
  { name: 'Leg Extension', category: 'legs', equipment: 'machine' },
  { name: 'Leg Curl', category: 'legs', equipment: 'machine' },
  { name: 'Calf Raise', category: 'legs', equipment: 'machine' },
  // shoulders
  { name: 'Overhead Press', category: 'shoulders', equipment: 'barbell' },
  { name: 'Dumbbell Shoulder Press', category: 'shoulders', equipment: 'dumbbell' },
  { name: 'Lateral Raise', category: 'shoulders', equipment: 'dumbbell' },
  { name: 'Rear Delt Fly', category: 'shoulders', equipment: 'dumbbell' },
  { name: 'Face Pull', category: 'shoulders', equipment: 'machine' },
  // arms
  { name: 'Barbell Curl', category: 'arms', equipment: 'barbell' },
  { name: 'Skull Crusher', category: 'arms', equipment: 'barbell' },
  { name: 'Dumbbell Curl', category: 'arms', equipment: 'dumbbell' },
  { name: 'Hammer Curl', category: 'arms', equipment: 'dumbbell' },
  { name: 'Overhead Triceps Extension', category: 'arms', equipment: 'dumbbell' },
  { name: 'Triceps Pushdown', category: 'arms', equipment: 'machine' },
  { name: 'Dip', category: 'arms', equipment: 'bodyweight' },
  // core
  { name: 'Cable Crunch', category: 'core', equipment: 'machine' },
  { name: 'Plank', category: 'core', equipment: 'bodyweight' },
  { name: 'Hanging Leg Raise', category: 'core', equipment: 'bodyweight' },
  { name: 'Ab Wheel Rollout', category: 'core', equipment: 'bodyweight' },
  { name: 'Sit-Up', category: 'core', equipment: 'bodyweight' },
]

/** Grouped in library order, for the wizard's checklist. */
export function starterByCategory(): Map<string, StarterExercise[]> {
  const groups = new Map<string, StarterExercise[]>()
  for (const exercise of STARTER_EXERCISES) {
    const group = groups.get(exercise.category)
    if (group) group.push(exercise)
    else groups.set(exercise.category, [exercise])
  }
  return groups
}
