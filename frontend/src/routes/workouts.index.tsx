import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, type Workout } from '@/lib/api'

export const Route = createFileRoute('/workouts/')({
  component: WorkoutsPage,
})

function todayIsoDate(): string {
  // Deliberately not toISOString(): that is the UTC date, so an evening
  // session west of Greenwich would default to tomorrow and a morning session
  // east of it to yesterday. Workouts are keyed by the day you trained.
  return new Date().toLocaleDateString('en-CA')
}

export function WorkoutsPage() {
  const queryClient = useQueryClient()
  const [performedOn, setPerformedOn] = useState(todayIsoDate())
  const [notes, setNotes] = useState('')
  const [deleting, setDeleting] = useState<Workout | null>(null)

  const { data: workouts, error: listError } = useQuery({
    queryKey: ['workouts'],
    queryFn: () => api.workouts.list(),
  })

  const createWorkout = useMutation({
    mutationFn: api.workouts.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
      setNotes('')
    },
  })

  const deleteWorkout = useMutation({
    mutationFn: (id: number) => api.workouts.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
      queryClient.invalidateQueries({ queryKey: ['analytics'] })
      setDeleting(null)
    },
  })

  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Workouts</h1>

      <Card>
        <CardHeader>
          <CardTitle>Log workout</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              createWorkout.mutate({ performed_on: performedOn, notes: notes || undefined })
            }}
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="workout-date">Date</Label>
                <Input
                  id="workout-date"
                  type="date"
                  value={performedOn}
                  onChange={(event) => setPerformedOn(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="workout-notes">Notes</Label>
                <Input
                  id="workout-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Notes (optional)"
                />
              </div>
              <Button type="submit" disabled={createWorkout.isPending}>
                Log workout
              </Button>
            </div>
          </form>
          {createWorkout.error && (
            <p className="mt-2 text-sm text-destructive">{createWorkout.error.message}</p>
          )}
        </CardContent>
      </Card>

      <div className="mt-4">
        {listError ? (
          <p className="text-sm text-destructive">
            Could not load workouts: {listError.message}
          </p>
        ) : workouts && workouts.length === 0 ? (
          <EmptyState
            title="No workouts yet"
            hint="Log your first workout above, then open it to add sets."
          />
        ) : workouts ? (
          <ul className="flex list-none flex-col gap-3 p-0">
            {workouts.map((workout) => (
              <li key={workout.id}>
                <Link
                  to="/workouts/$workoutId"
                  params={{ workoutId: String(workout.id) }}
                  className="block no-underline"
                >
                  <Card className="py-4 transition-colors hover:border-primary">
                    <CardContent className="flex items-center justify-between">
                      <div>
                        <strong className="font-semibold">{workout.performed_on}</strong>
                        {workout.notes && (
                          <p className="text-sm text-muted-foreground">{workout.notes}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(event) => {
                          event.preventDefault()
                          setDeleting(workout)
                        }}
                      >
                        Delete
                      </Button>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {deleting && (
        <ConfirmDialog
          title={`Delete workout on ${deleting.performed_on}?`}
          message="This deletes the workout and all its sets."
          confirmLabel="Delete"
          danger
          isPending={deleteWorkout.isPending}
          error={deleteWorkout.error ? deleteWorkout.error.message : null}
          onConfirm={() => deleteWorkout.mutate(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  )
}
