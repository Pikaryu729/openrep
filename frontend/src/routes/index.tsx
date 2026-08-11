import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api } from '@/lib/api'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'volume'],
    queryFn: api.analytics.volumeByDay,
  })

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (error) return <p className="text-sm text-destructive">Failed to load: {error.message}</p>

  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Training volume</h1>
      {data && data.length === 0 ? (
        <EmptyState
          title="No workouts logged yet"
          hint="Your daily training volume will show up here."
          action={
            <Button variant="outline" asChild>
              <Link to="/workouts">Log a workout</Link>
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Sets</TableHead>
                <TableHead>Volume (kg)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((day) => (
                <TableRow key={day.performed_on}>
                  <TableCell>{day.performed_on}</TableCell>
                  <TableCell>{day.total_sets}</TableCell>
                  <TableCell>{day.total_volume_kg}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  )
}
