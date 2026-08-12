import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiError, api, type Exercise } from '@/lib/api'

export const Route = createFileRoute('/exercises/')({
  component: ExercisesPage,
})

function conflictMessage(error: unknown): string | null {
  if (error instanceof ApiError && error.status === 409) {
    return 'An exercise with this name already exists.'
  }
  if (error instanceof Error) return error.message
  return error ? String(error) : null
}

export function ExercisesPage() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [deleting, setDeleting] = useState<Exercise | null>(null)

  const { data: exercises, error: listError } = useQuery({
    queryKey: ['exercises'],
    queryFn: api.exercises.list,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['exercises'] })

  const createExercise = useMutation({
    mutationFn: api.exercises.create,
    onSuccess: () => {
      invalidate()
      setName('')
      setCategory('')
      setNotes('')
    },
  })

  const deleteExercise = useMutation({
    mutationFn: (id: number) => api.exercises.delete(id),
    onSuccess: () => {
      invalidate()
      setDeleting(null)
    },
  })

  return (
    <section>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">Exercises</h1>

      <Card>
        <CardHeader>
          <CardTitle>Add exercise</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!name.trim()) return
              createExercise.mutate({
                name,
                category: category || undefined,
                notes: notes || undefined,
              })
            }}
          >
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="exercise-name">Name</Label>
                <Input
                  id="exercise-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Exercise name"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="exercise-category">Category</Label>
                <Input
                  id="exercise-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Category (optional)"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="exercise-notes">Notes</Label>
                <Input
                  id="exercise-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Notes (optional)"
                />
              </div>
              <Button type="submit" disabled={createExercise.isPending}>
                Add
              </Button>
            </div>
          </form>
          {createExercise.error && (
            <p className="mt-2 text-sm text-destructive">
              {conflictMessage(createExercise.error)}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="mt-4">
        {listError ? (
          <p className="text-sm text-destructive">
            Could not load exercises: {listError.message}
          </p>
        ) : exercises && exercises.length === 0 ? (
          <EmptyState
            title="No exercises yet"
            hint="Add your first exercise above to start logging sets."
          />
        ) : exercises ? (
          <div className="rounded-lg border bg-card shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {exercises.map((exercise) => (
                  <TableRow key={exercise.id}>
                    <TableCell>
                      <Link
                        to="/exercises/$exerciseId"
                        params={{ exerciseId: String(exercise.id) }}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {exercise.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{exercise.category}</TableCell>
                    <TableCell className="text-muted-foreground">{exercise.notes}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(exercise)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            deleteExercise.reset()
                            setDeleting(exercise)
                          }}
                        >
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </div>

      {editing && <EditExerciseModal exercise={editing} onClose={() => setEditing(null)} />}

      {deleting && (
        <ConfirmDialog
          title={`Delete ${deleting.name}?`}
          message="This removes the exercise from your library."
          confirmLabel="Delete"
          danger
          isPending={deleteExercise.isPending}
          error={
            deleteExercise.error instanceof ApiError && deleteExercise.error.status === 409
              ? 'This exercise is used by logged sets and cannot be deleted.'
              : deleteExercise.error
                ? deleteExercise.error.message
                : null
          }
          onConfirm={() => deleteExercise.mutate(deleting.id)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </section>
  )
}

function EditExerciseModal({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(exercise.name)
  const [category, setCategory] = useState(exercise.category)
  const [notes, setNotes] = useState(exercise.notes ?? '')

  const updateExercise = useMutation({
    mutationFn: (data: { name: string; category: string; notes: string | null }) =>
      api.exercises.update(exercise.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['exercises'] })
      onClose()
    },
  })

  return (
    <Modal title="Edit exercise" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim()) return
          updateExercise.mutate({ name, category, notes: notes || null })
        }}
      >
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="edit-exercise-name">Name</Label>
            <Input
              id="edit-exercise-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-exercise-category">Category</Label>
            <Input
              id="edit-exercise-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="edit-exercise-notes">Notes</Label>
            <Input
              id="edit-exercise-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </div>
        {updateExercise.error && (
          <p className="mt-2 text-sm text-destructive">
            {conflictMessage(updateExercise.error)}
          </p>
        )}
        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={updateExercise.isPending}>
            Save
          </Button>
        </DialogFooter>
      </form>
    </Modal>
  )
}
