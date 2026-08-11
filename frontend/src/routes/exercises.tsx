import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../lib/api'

export const Route = createFileRoute('/exercises')({
  component: ExercisesPage,
})

export function ExercisesPage() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')

  const { data: exercises } = useQuery({
    queryKey: ['exercises'],
    queryFn: api.exercises.list,
  })

  const createExercise = useMutation({
    mutationFn: api.exercises.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] })
      setName('')
      setCategory('')
    },
  })

  return (
    <section>
      <h1>Exercises</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return
          createExercise.mutate({ name, category: category || undefined })
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Exercise name"
        />
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Category (optional)"
        />
        <button type="submit" disabled={createExercise.isPending}>
          Add
        </button>
      </form>
      <ul>
        {exercises?.map((exercise) => (
          <li key={exercise.id}>
            {exercise.name} <span className="muted">({exercise.category})</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
