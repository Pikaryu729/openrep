import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { api } from '../lib/api'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function Dashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'volume'],
    queryFn: api.analytics.volumeByDay,
  })

  if (isLoading) return <p>Loading…</p>
  if (error) return <p>Failed to load: {error.message}</p>

  return (
    <section>
      <h1>Training volume</h1>
      {data && data.length === 0 && <p>No workouts logged yet.</p>}
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Sets</th>
            <th>Volume (kg)</th>
          </tr>
        </thead>
        <tbody>
          {data?.map((day) => (
            <tr key={day.performed_on}>
              <td>{day.performed_on}</td>
              <td>{day.total_sets}</td>
              <td>{day.total_volume_kg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
