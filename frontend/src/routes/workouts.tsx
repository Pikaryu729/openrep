import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../lib/api'

export const Route = createFileRoute('/workouts')({
  component: WorkoutsPage,
})

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function WorkoutsPage() {
  const queryClient = useQueryClient()
  const [performedOn, setPerformedOn] = useState(todayIsoDate())

  const { data: workouts } = useQuery({
    queryKey: ['workouts'],
    queryFn: api.workouts.list,
  })

  const createWorkout = useMutation({
    mutationFn: api.workouts.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
    },
  })

  return (
    <section>
      <h1>Workouts</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          createWorkout.mutate({ performed_on: performedOn })
        }}
      >
        <input
          type="date"
          value={performedOn}
          onChange={(event) => setPerformedOn(event.target.value)}
        />
        <button type="submit" disabled={createWorkout.isPending}>
          Log workout
        </button>
      </form>
      <ul>
        {workouts?.map((workout) => (
          <li key={workout.id}>{workout.performed_on}</li>
        ))}
      </ul>
    </section>
  )
}
