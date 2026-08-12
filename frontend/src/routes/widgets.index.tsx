import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type CustomWidget } from '@/lib/api'
import { describeQuery } from '@/lib/widgetQuery'

export const Route = createFileRoute('/widgets/')({
  component: WidgetsIndex,
})

export function WidgetsIndex() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmingDelete, setConfirmingDelete] = useState<CustomWidget | null>(null)

  const widgetsQuery = useQuery({ queryKey: ['widgets'], queryFn: api.widgets.list })
  const catalogQuery = useQuery({
    queryKey: ['widgets', 'catalog'],
    queryFn: api.widgets.catalog,
    staleTime: Number.POSITIVE_INFINITY,
  })

  const deleteWidget = useMutation({
    mutationFn: (id: number) => api.widgets.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['widgets'] })
      setConfirmingDelete(null)
    },
  })

  if (widgetsQuery.error) {
    return (
      <p className="text-destructive text-sm">
        Could not load your widgets: {widgetsQuery.error.message}
      </p>
    )
  }

  const widgets = widgetsQuery.data

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-semibold text-2xl tracking-tight">Your widgets</h1>
        <Button size="sm" onClick={() => navigate({ to: '/widgets/new' })}>
          Create widget
        </Button>
      </div>

      {deleteWidget.error && (
        <p className="mb-4 text-destructive text-sm">
          Could not delete that widget: {deleteWidget.error.message}
        </p>
      )}

      {!widgets ? (
        <Skeleton className="h-24 w-full" />
      ) : widgets.length === 0 ? (
        <EmptyState
          title="You haven't built any widgets yet"
          hint="A widget is a question about your training — total volume per week, best estimated 1RM by exercise, how often you train each category. Build one and put it on your dashboard."
          action={
            <Button variant="outline" onClick={() => navigate({ to: '/widgets/new' })}>
              Create your first widget
            </Button>
          }
        />
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {widgets.map((widget) => (
            <li key={widget.id}>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                  <div className="min-w-0">
                    <CardTitle asChild>
                      <h2 className="truncate">{widget.name}</h2>
                    </CardTitle>
                    {widget.description && (
                      <p className="mt-1 text-muted-foreground text-sm">{widget.description}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/widgets/$widgetId" params={{ widgetId: String(widget.id) }}>
                        Edit
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete ${widget.name}`}
                      onClick={() => setConfirmingDelete(widget)}
                    >
                      Delete
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    {catalogQuery.data
                      ? describeQuery(widget.query, catalogQuery.data)
                      : `${widget.visualization} chart`}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete "${confirmingDelete.name}"?`}
          // Honest about the consequence: the server does not block this on
          // dashboard placements, it leaves them to render as "missing".
          message="Any dashboard placement of this widget will stop showing data. Your training data is untouched."
          confirmLabel="Delete"
          danger
          onConfirm={() => deleteWidget.mutate(confirmingDelete.id)}
          onCancel={() => setConfirmingDelete(null)}
        />
      )}
    </section>
  )
}
