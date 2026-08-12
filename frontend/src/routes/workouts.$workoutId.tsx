import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiError, api, type Exercise, type SetEntry } from '@/lib/api'
import { displayToKg, kgToDisplay, useUnits, weightUnit } from '@/lib/units'

export const Route = createFileRoute('/workouts/$workoutId')({
  component: WorkoutDetailRoute,
})

/** Native <select> styled to match the shadcn Input (Radix Select is overkill
 * for a plain exercise picker and doesn't drive well from tests). */
const selectClassName =
  'h-9 w-fit min-w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30'

function WorkoutDetailRoute() {
  const { workoutId } = Route.useParams()
  return <WorkoutDetailPage workoutId={Number(workoutId)} />
}

export function WorkoutDetailPage({ workoutId }: { workoutId: number }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const units = useUnits()
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const workoutQuery = useQuery({
    queryKey: ['workouts', workoutId],
    queryFn: () => api.workouts.get(workoutId),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 3,
  })
  const setsQuery = useQuery({
    queryKey: ['sets', { workoutId }],
    queryFn: () => api.sets.listByWorkout(workoutId),
  })
  const exercisesQuery = useQuery({
    queryKey: ['exercises'],
    queryFn: api.exercises.list,
  })

  const invalidateSets = () => {
    queryClient.invalidateQueries({ queryKey: ['sets', { workoutId }] })
    queryClient.invalidateQueries({ queryKey: ['analytics'] })
  }

  const updateWorkout = useMutation({
    mutationFn: (data: { performed_on?: string; notes?: string | null }) =>
      api.workouts.update(workoutId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
    },
  })

  const deleteWorkout = useMutation({
    mutationFn: () => api.workouts.delete(workoutId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      navigate({ to: '/workouts' })
    },
  })

  if (workoutQuery.error instanceof ApiError && workoutQuery.error.status === 404) {
    return (
      <EmptyState
        title="Workout not found"
        hint="It may have been deleted."
        action={
          <Button variant="outline" asChild>
            <Link to="/workouts">Back to workouts</Link>
          </Button>
        }
      />
    )
  }
  if (workoutQuery.error) {
    return (
      <p className="text-sm text-destructive">
        Could not load workout: {workoutQuery.error.message}
      </p>
    )
  }
  if (!workoutQuery.data) {
    return <p className="text-muted-foreground">Loading…</p>
  }

  const workout = workoutQuery.data
  // Never `?? []`: an empty array here is indistinguishable from a failed or
  // still-pending fetch, and both would render as "no sets yet" — i.e. the
  // user's logged sets silently appearing to have vanished.
  const sets = setsQuery.data
  const exercises = exercisesQuery.data
  const contentError = setsQuery.error ?? exercisesQuery.error
  const exerciseById = new Map((exercises ?? []).map((exercise) => [exercise.id, exercise]))

  return (
    <section>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Workout · {workout.performed_on}
          </h1>
          <p className="text-sm text-muted-foreground">
            Logged {new Date(workout.created_at).toLocaleDateString()}
          </p>
        </div>
        <Button variant="destructive" onClick={() => setConfirmingDelete(true)}>
          Delete workout
        </Button>
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="workout-date">Date</Label>
              <Input
                id="workout-date"
                type="date"
                value={workout.performed_on}
                onChange={(event) => updateWorkout.mutate({ performed_on: event.target.value })}
              />
            </div>
            <div className="grid flex-1 gap-1.5">
              <Label htmlFor="workout-notes">Notes</Label>
              <Input
                id="workout-notes"
                key={`${workout.id}:${workout.notes ?? ''}`}
                defaultValue={workout.notes ?? ''}
                placeholder="Notes (optional)"
                onBlur={(event) => {
                  const value = event.target.value || null
                  if (value !== workout.notes) updateWorkout.mutate({ notes: value })
                }}
              />
            </div>
          </div>
          {updateWorkout.error && (
            <p className="mt-2 text-sm text-destructive">{updateWorkout.error.message}</p>
          )}
        </CardContent>
      </Card>

      {contentError ? (
        <p className="mt-4 text-sm text-destructive">
          Could not load this workout's sets: {contentError.message}
        </p>
      ) : !sets || !exercises ? (
        <p className="mt-4 text-muted-foreground">Loading sets…</p>
      ) : (
        <>
          <div className="mt-4">
            {sets.length === 0 ? (
              <EmptyState title="No sets yet" hint="Add your first set below." />
            ) : (
              <div className="rounded-lg border bg-card shadow-xs">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exercise</TableHead>
                      <TableHead>Weight ({weightUnit(units)})</TableHead>
                      <TableHead>Reps</TableHead>
                      <TableHead>RPE</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sets.map((setEntry, index) => (
                      <SetRow
                        key={setEntry.id}
                        setEntry={setEntry}
                        exerciseName={exerciseById.get(setEntry.exercise_id)?.name ?? '—'}
                        prev={index > 0 ? sets[index - 1] : null}
                        next={index < sets.length - 1 ? sets[index + 1] : null}
                        onChanged={invalidateSets}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {exercises.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No exercises in your library"
                hint="Create an exercise first, then log sets against it."
                action={
                  <Button variant="outline" asChild>
                    <Link to="/exercises">Go to exercises</Link>
                  </Button>
                }
              />
            </div>
          ) : (
            <AddSetForm
              workoutId={workoutId}
              exercises={exercises}
              sets={sets}
              onCreated={invalidateSets}
            />
          )}
        </>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete workout on ${workout.performed_on}?`}
          message="This deletes the workout and all its sets."
          confirmLabel="Delete"
          danger
          isPending={deleteWorkout.isPending}
          error={deleteWorkout.error ? deleteWorkout.error.message : null}
          onConfirm={() => deleteWorkout.mutate()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </section>
  )
}

function SetRow({
  setEntry,
  exerciseName,
  prev,
  next,
  onChanged,
}: {
  setEntry: SetEntry
  exerciseName: string
  prev: SetEntry | null
  next: SetEntry | null
  onChanged: () => void
}) {
  const units = useUnits()
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [weight, setWeight] = useState(String(kgToDisplay(setEntry.weight_kg, units)))
  const [reps, setReps] = useState(String(setEntry.reps))
  const [rpe, setRpe] = useState(setEntry.rpe == null ? '' : String(setEntry.rpe))

  const updateSet = useMutation({
    mutationFn: (data: { weight_kg?: number; reps?: number; rpe?: number | null }) =>
      api.sets.update(setEntry.id, data),
    onSuccess: () => {
      onChanged()
      setEditing(false)
    },
  })

  const deleteSet = useMutation({
    mutationFn: () => api.sets.delete(setEntry.id),
    onSuccess: () => {
      onChanged()
      setConfirmingDelete(false)
    },
  })

  const swapWith = useMutation({
    mutationFn: (other: SetEntry) =>
      api.sets.reorder([
        { id: setEntry.id, set_order: other.set_order },
        { id: other.id, set_order: setEntry.set_order },
      ]),
    onSuccess: onChanged,
  })

  if (editing) {
    return (
      <TableRow>
        <TableCell>{exerciseName}</TableCell>
        <TableCell>
          <Input
            type="number"
            step="0.5"
            min="0"
            aria-label={`Weight (${weightUnit(units)})`}
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            className="w-22"
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            min="1"
            aria-label="Reps"
            value={reps}
            onChange={(event) => setReps(event.target.value)}
            className="w-18"
          />
        </TableCell>
        <TableCell>
          <Input
            type="number"
            step="0.5"
            min="1"
            max="10"
            aria-label="RPE"
            value={rpe}
            onChange={(event) => setRpe(event.target.value)}
            className="w-18"
          />
        </TableCell>
        <TableCell>
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              disabled={updateSet.isPending}
              onClick={() =>
                updateSet.mutate({
                  weight_kg: displayToKg(Number(weight), units),
                  reps: Number(reps),
                  rpe: rpe === '' ? null : Number(rpe),
                })
              }
            >
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow>
      <TableCell>{exerciseName}</TableCell>
      <TableCell>{kgToDisplay(setEntry.weight_kg, units)}</TableCell>
      <TableCell>{setEntry.reps}</TableCell>
      <TableCell className="text-muted-foreground">{setEntry.rpe ?? '—'}</TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Move set up"
            disabled={!prev || swapWith.isPending}
            onClick={() => prev && swapWith.mutate(prev)}
          >
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Move set down"
            disabled={!next || swapWith.isPending}
            onClick={() => next && swapWith.mutate(next)}
          >
            ↓
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setWeight(String(kgToDisplay(setEntry.weight_kg, units)))
              setReps(String(setEntry.reps))
              setRpe(setEntry.rpe == null ? '' : String(setEntry.rpe))
              setEditing(true)
            }}
          >
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(true)}>
            Delete
          </Button>
        </div>
        {confirmingDelete && (
          <ConfirmDialog
            title="Delete set?"
            message={`${exerciseName} — ${kgToDisplay(setEntry.weight_kg, units)} ${weightUnit(units)} × ${setEntry.reps}`}
            confirmLabel="Delete"
            danger
            isPending={deleteSet.isPending}
            error={deleteSet.error ? deleteSet.error.message : null}
            onConfirm={() => deleteSet.mutate()}
            onCancel={() => setConfirmingDelete(false)}
          />
        )}
      </TableCell>
    </TableRow>
  )
}

function AddSetForm({
  workoutId,
  exercises,
  sets,
  onCreated,
}: {
  workoutId: number
  exercises: Exercise[]
  sets: SetEntry[]
  onCreated: () => void
}) {
  const units = useUnits()
  const [exerciseId, setExerciseId] = useState<number>(exercises[0].id)
  // The list refetches on window focus, so the selected exercise can be
  // deleted out from under us. A <select> whose value matches no option
  // displays the first one — without this the form would POST the id the user
  // can no longer see, and get a 404 contradicting the picker.
  const selectedId = exercises.some((exercise) => exercise.id === exerciseId)
    ? exerciseId
    : exercises[0].id
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [rpe, setRpe] = useState('')

  const createSet = useMutation({
    mutationFn: (data: Parameters<typeof api.sets.create>[0]) => api.sets.create(data),
    onSuccess: () => {
      onCreated()
      setRpe('')
    },
  })

  const prefillFrom = (id: number) => {
    const lastOfExercise = [...sets].reverse().find((entry) => entry.exercise_id === id)
    if (lastOfExercise) {
      setWeight(String(kgToDisplay(lastOfExercise.weight_kg, units)))
      setReps(String(lastOfExercise.reps))
    }
  }

  return (
    <Card className="mt-4">
      <CardContent>
        <h2 className="mb-3 font-semibold">Add set</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (weight === '' || reps === '') return
            createSet.mutate({
              workout_id: workoutId,
              exercise_id: selectedId,
              weight_kg: displayToKg(Number(weight), units),
              reps: Number(reps),
              rpe: rpe === '' ? undefined : Number(rpe),
              set_order: sets.length ? Math.max(...sets.map((entry) => entry.set_order)) + 1 : 1,
            })
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="add-set-exercise">Exercise</Label>
              <select
                id="add-set-exercise"
                className={selectClassName}
                value={selectedId}
                onChange={(event) => {
                  const id = Number(event.target.value)
                  setExerciseId(id)
                  prefillFrom(id)
                }}
              >
                {exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-set-weight">Weight ({weightUnit(units)})</Label>
              <Input
                id="add-set-weight"
                type="number"
                step="0.5"
                min="0"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                className="w-24"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-set-reps">Reps</Label>
              <Input
                id="add-set-reps"
                type="number"
                min="1"
                value={reps}
                onChange={(event) => setReps(event.target.value)}
                className="w-20"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="add-set-rpe">RPE</Label>
              <Input
                id="add-set-rpe"
                type="number"
                step="0.5"
                min="1"
                max="10"
                value={rpe}
                onChange={(event) => setRpe(event.target.value)}
                placeholder="—"
                className="w-20"
              />
            </div>
            <Button type="submit" disabled={createSet.isPending}>
              Add set
            </Button>
          </div>
        </form>
        {createSet.error && (
          <p className="mt-2 text-sm text-destructive">{createSet.error.message}</p>
        )}
      </CardContent>
    </Card>
  )
}
