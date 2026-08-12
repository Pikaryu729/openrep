import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { EmptyState } from '@/components/EmptyState'
import { StatTile } from '@/components/StatTile'
import { VolumeChart } from '@/components/VolumeChart'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type VolumeByDay } from '@/lib/api'
import { longDate, shortDate } from '@/lib/format'
import { kgToDisplay, type UnitSystem, useUnits, weightUnit } from '@/lib/units'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

/** Compact large numbers so a stat tile stays one line: 12480 → 12.5K. */
function compact(value: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
    value,
  )
}

function summarise(data: VolumeByDay[], units: UnitSystem) {
  const totalVolume = data.reduce((sum, day) => sum + day.total_volume_kg, 0)
  const totalSets = data.reduce((sum, day) => sum + day.total_sets, 0)
  return {
    sessions: data.length,
    totalSets,
    totalVolume: kgToDisplay(totalVolume, units),
    lastSession: data.length ? data[data.length - 1].performed_on : null,
  }
}

export function Dashboard() {
  const units = useUnits()
  const volumeQuery = useQuery({
    queryKey: ['analytics', 'volume'],
    queryFn: api.analytics.volumeByDay,
  })
  const recordsQuery = useQuery({
    queryKey: ['analytics', 'personal-records'],
    queryFn: () => api.analytics.recentPersonalRecords(5),
  })

  if (volumeQuery.error) {
    return (
      <p className="text-destructive text-sm">Failed to load: {volumeQuery.error.message}</p>
    )
  }
  if (!volumeQuery.data) {
    return (
      <section>
        <h1 className="mb-6 font-semibold text-2xl tracking-tight">Dashboard</h1>
        <Skeleton className="h-24 w-full" />
      </section>
    )
  }

  const volume = volumeQuery.data
  const stats = summarise(volume, units)

  if (volume.length === 0) {
    return (
      <section>
        <h1 className="mb-6 font-semibold text-2xl tracking-tight">Dashboard</h1>
        <EmptyState
          title="No workouts logged yet"
          hint="Your training volume and personal records will show up here."
          action={
            <Button variant="outline" asChild>
              <Link to="/workouts">Log a workout</Link>
            </Button>
          }
        />
      </section>
    )
  }

  return (
    <section>
      <h1 className="mb-6 font-semibold text-2xl tracking-tight">Dashboard</h1>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Sessions" value={String(stats.sessions)} />
        <StatTile label="Sets logged" value={String(stats.totalSets)} />
        <StatTile
          label="Total volume"
          value={compact(stats.totalVolume)}
          unit={weightUnit(units)}
        />
        <StatTile
          label="Last session"
          value={stats.lastSession ? shortDate(stats.lastSession) : '—'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Training volume ({weightUnit(units)} per session)</CardTitle>
        </CardHeader>
        <CardContent>
          <VolumeChart data={volume} units={units} />
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Personal records</CardTitle>
        </CardHeader>
        <CardContent>
          {recordsQuery.error ? (
            <p className="text-destructive text-sm">
              Could not load records: {recordsQuery.error.message}
            </p>
          ) : !recordsQuery.data ? (
            <Skeleton className="h-20 w-full" />
          ) : recordsQuery.data.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Log a set to see your best estimated 1RM per exercise.
            </p>
          ) : (
            <ul className="flex list-none flex-col gap-2 p-0">
              {recordsQuery.data.map((record) => (
                <li key={record.exercise_id}>
                  <Link
                    to="/exercises/$exerciseId"
                    params={{ exerciseId: String(record.exercise_id) }}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 no-underline transition-colors hover:border-primary"
                  >
                    <span className="font-medium">{record.exercise_name}</span>
                    <span className="flex items-baseline gap-3">
                      <span className="text-muted-foreground text-xs">
                        {longDate(record.achieved_on)}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {kgToDisplay(record.max_estimated_1rm_kg, units)}
                        <span className="ml-1 font-normal text-muted-foreground text-xs">
                          {weightUnit(units)}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
