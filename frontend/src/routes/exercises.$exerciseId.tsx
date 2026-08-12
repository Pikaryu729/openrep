import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { EmptyState } from '@/components/EmptyState'
import { ExerciseProgressChart, toSessionPoints } from '@/components/ExerciseProgressChart'
import { StatTile } from '@/components/StatTile'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, api } from '@/lib/api'
import { longDate } from '@/lib/format'
import { kgToDisplay, type UnitSystem, useUnits, weightUnit } from '@/lib/units'

export const Route = createFileRoute('/exercises/$exerciseId')({
  component: ExerciseDetailRoute,
})

function ExerciseDetailRoute() {
  const { exerciseId } = Route.useParams()
  return <ExerciseDetailPage exerciseId={Number(exerciseId)} />
}

function prTile(
  label: string,
  kg: number | null,
  achievedOn: string | null,
  units: UnitSystem,
) {
  return (
    <StatTile
      label={label}
      value={kg == null ? '—' : String(kgToDisplay(kg, units))}
      unit={kg == null ? undefined : weightUnit(units)}
      hint={achievedOn ? longDate(achievedOn) : null}
    />
  )
}

export function ExerciseDetailPage({ exerciseId }: { exerciseId: number }) {
  const units = useUnits()

  const exerciseQuery = useQuery({
    queryKey: ['exercises', exerciseId],
    queryFn: () => api.exercises.get(exerciseId),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status === 404) && failureCount < 3,
  })
  const historyQuery = useQuery({
    queryKey: ['analytics', 'history', exerciseId],
    queryFn: () => api.analytics.exerciseHistory(exerciseId),
  })
  const recordsQuery = useQuery({
    queryKey: ['analytics', 'records', exerciseId],
    queryFn: () => api.analytics.exercisePersonalRecords(exerciseId),
  })

  if (exerciseQuery.error instanceof ApiError && exerciseQuery.error.status === 404) {
    return (
      <EmptyState
        title="Exercise not found"
        hint="It may have been deleted."
        action={
          <Button variant="outline" asChild>
            <Link to="/exercises">Back to exercises</Link>
          </Button>
        }
      />
    )
  }
  if (exerciseQuery.error) {
    return (
      <p className="text-destructive text-sm">
        Could not load exercise: {exerciseQuery.error.message}
      </p>
    )
  }
  if (!exerciseQuery.data) {
    return <p className="text-muted-foreground">Loading…</p>
  }

  const exercise = exerciseQuery.data
  const analyticsError = historyQuery.error ?? recordsQuery.error
  const sessions = historyQuery.data ? toSessionPoints(historyQuery.data, units) : null

  return (
    <section>
      <div className="mb-6">
        <Link to="/exercises" className="text-muted-foreground text-sm">
          ← Exercises
        </Link>
        <h1 className="mt-1 font-semibold text-2xl tracking-tight">{exercise.name}</h1>
        <p className="text-muted-foreground text-sm">{exercise.category}</p>
      </div>

      {analyticsError ? (
        <p className="text-destructive text-sm">
          Could not load progress: {analyticsError.message}
        </p>
      ) : !sessions || !recordsQuery.data ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {prTile(
              'Heaviest set',
              recordsQuery.data.max_weight_kg,
              recordsQuery.data.max_weight_achieved_on,
              units,
            )}
            {prTile(
              'Best est. 1RM',
              recordsQuery.data.max_estimated_1rm_kg,
              recordsQuery.data.max_estimated_1rm_achieved_on,
              units,
            )}
            {prTile(
              'Best session volume',
              recordsQuery.data.max_volume_in_a_workout_kg,
              recordsQuery.data.max_volume_achieved_on,
              units,
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <EmptyState
                  title="No sets logged for this exercise"
                  hint="Log a set against it and your progress will chart here."
                  action={
                    <Button variant="outline" asChild>
                      <Link to="/workouts">Go to workouts</Link>
                    </Button>
                  }
                />
              ) : (
                <ExerciseProgressChart data={sessions} units={units} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  )
}
