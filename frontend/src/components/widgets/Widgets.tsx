import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CategoryVolumeChart, toCategoryRows } from '@/components/CategoryVolumeChart'
import { EmptyState } from '@/components/EmptyState'
import { ExerciseProgressChart, toSessionPoints } from '@/components/ExerciseProgressChart'
import { StatTile } from '@/components/StatTile'
import { VolumeChart } from '@/components/VolumeChart'
import { Button } from '@/components/ui/button'
import { api, type VolumeByDay } from '@/lib/api'
import type {
  CategoryOptions,
  ProgressOptions,
  RecentOptions,
  RecordsOptions,
  StatTilesOptions,
  VolumeOptions,
} from '@/lib/dashboard'
import { compact, longDate, shortDate } from '@/lib/format'
import { kgToDisplay, type UnitSystem, useUnits, weightUnit } from '@/lib/units'
import { WidgetState } from './WidgetStates'
import { rangeStart } from './widgetData'

function summarise(data: VolumeByDay[], units: UnitSystem) {
  return {
    sessions: data.length,
    sets: data.reduce((sum, day) => sum + day.total_sets, 0),
    volume: kgToDisplay(
      data.reduce((sum, day) => sum + day.total_volume_kg, 0),
      units,
    ),
    last_session: data.length ? data[data.length - 1].performed_on : null,
  }
}

export function StatTilesWidget({ options }: { options: StatTilesOptions }) {
  const units = useUnits()
  const query = useQuery({
    queryKey: ['analytics', 'volume', {}],
    queryFn: () => api.analytics.volumeByDay(),
  })
  const stats = query.data ? summarise(query.data, units) : null

  return (
    <WidgetState
      error={query.error}
      loading={!query.data}
      empty={query.data?.length === 0}
      emptyMessage={
        <EmptyState
          title="No workouts logged yet"
          hint="Your training volume and personal records will show up here."
          action={
            <Button variant="outline" asChild>
              <Link to="/workouts">Log a workout</Link>
            </Button>
          }
        />
      }
    >
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {options.metrics.includes('sessions') && (
            <StatTile label="Sessions" value={String(stats.sessions)} />
          )}
          {options.metrics.includes('sets') && (
            <StatTile label="Sets logged" value={String(stats.sets)} />
          )}
          {options.metrics.includes('volume') && (
            <StatTile label="Total volume" value={compact(stats.volume)} unit={weightUnit(units)} />
          )}
          {options.metrics.includes('last_session') && (
            <StatTile
              label="Last session"
              value={stats.last_session ? shortDate(stats.last_session) : '—'}
            />
          )}
        </div>
      )}
    </WidgetState>
  )
}

export function VolumeChartWidget({ options }: { options: VolumeOptions }) {
  const units = useUnits()
  const start = rangeStart(options.range_days)
  const query = useQuery({
    queryKey: ['analytics', 'volume', { start }],
    queryFn: () => api.analytics.volumeByDay({ start }),
  })

  return (
    <WidgetState
      error={query.error}
      loading={!query.data}
      empty={query.data?.length === 0}
      emptyMessage="No sessions logged in this range."
    >
      {query.data && <VolumeChart data={query.data} units={units} />}
    </WidgetState>
  )
}

export function PersonalRecordsWidget({ options }: { options: RecordsOptions }) {
  const units = useUnits()
  const query = useQuery({
    queryKey: ['analytics', 'personal-records', { limit: options.limit }],
    queryFn: () => api.analytics.recentPersonalRecords(options.limit),
  })

  return (
    <WidgetState
      error={query.error}
      loading={!query.data}
      empty={query.data?.length === 0}
      emptyMessage="Log a set to see your best estimated 1RM per exercise."
    >
      <ul className="flex list-none flex-col gap-2 p-0">
        {query.data?.map((record) => (
          <li key={record.exercise_id}>
            <Link
              to="/exercises/$exerciseId"
              params={{ exerciseId: String(record.exercise_id) }}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 no-underline transition-colors hover:border-primary"
            >
              <span className="font-medium">{record.exercise_name}</span>
              <span className="flex items-baseline gap-3">
                <span className="text-muted-foreground text-xs">{longDate(record.achieved_on)}</span>
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
    </WidgetState>
  )
}

export function ExerciseProgressWidget({ options }: { options: ProgressOptions }) {
  const units = useUnits()
  const exercisesQuery = useQuery({ queryKey: ['exercises'], queryFn: api.exercises.list })
  const historyQuery = useQuery({
    queryKey: ['analytics', 'history', options.exercise_id],
    queryFn: () => api.analytics.exerciseHistory(options.exercise_id as number),
    enabled: options.exercise_id != null,
  })

  if (options.exercise_id == null) {
    return (
      <p className="text-muted-foreground text-sm">
        Choose an exercise in this widget's settings.
      </p>
    )
  }

  // The history endpoint returns [] for a deleted exercise rather than 404, so
  // without this check a stale widget would render an innocuous empty chart.
  if (exercisesQuery.data && !exercisesQuery.data.some((e) => e.id === options.exercise_id)) {
    return (
      <p className="text-muted-foreground text-sm">
        That exercise no longer exists — pick another in this widget's settings.
      </p>
    )
  }

  const sessions = historyQuery.data ? toSessionPoints(historyQuery.data, units) : null

  return (
    <WidgetState
      error={historyQuery.error ?? exercisesQuery.error}
      loading={!sessions}
      empty={sessions?.length === 0}
      emptyMessage="No sets logged for this exercise yet."
    >
      {sessions && <ExerciseProgressChart data={sessions} units={units} />}
    </WidgetState>
  )
}

export function RecentWorkoutsWidget({ options }: { options: RecentOptions }) {
  const start = rangeStart(options.range_days)
  const query = useQuery({
    queryKey: [
      'workouts',
      {
        limit: options.limit,
        start,
        exercise_id: options.exercise_id,
        category: options.category,
      },
    ],
    // A distinct key from the bare ['workouts'] the sidebar and workouts page
    // share, so a filtered result never clobbers their cache.
    queryFn: () =>
      api.workouts.list({
        limit: options.limit,
        start,
        exercise_id: options.exercise_id,
        category: options.category,
      }),
  })

  return (
    <WidgetState
      error={query.error}
      loading={!query.data}
      empty={query.data?.length === 0}
      emptyMessage="No workouts match this filter."
    >
      <ul className="flex list-none flex-col gap-2 p-0">
        {query.data?.map((workout) => (
          <li key={workout.id}>
            <Link
              to="/workouts/$workoutId"
              params={{ workoutId: String(workout.id) }}
              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 no-underline transition-colors hover:border-primary"
            >
              <span className="font-medium">{longDate(workout.performed_on)}</span>
              {workout.notes && (
                <span className="truncate text-muted-foreground text-xs">{workout.notes}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </WidgetState>
  )
}

export function CategoryBreakdownWidget({ options }: { options: CategoryOptions }) {
  const units = useUnits()
  const start = rangeStart(options.range_days)
  const query = useQuery({
    queryKey: ['analytics', 'volume-by-category', { start }],
    queryFn: () => api.analytics.volumeByCategory({ start }),
  })
  const rows = query.data ? toCategoryRows(query.data, units, options.max_categories) : null

  return (
    <WidgetState
      error={query.error}
      loading={!rows}
      empty={rows?.length === 0}
      emptyMessage="No volume logged in this range."
    >
      {rows && <CategoryVolumeChart rows={rows} units={units} />}
    </WidgetState>
  )
}
