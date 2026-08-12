import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { WidgetEditor } from '@/components/WidgetEditor'
import { Skeleton } from '@/components/ui/skeleton'
import { api, type CustomWidgetInput } from '@/lib/api'

export const Route = createFileRoute('/widgets/$widgetId')({
  component: EditWidget,
})

export function EditWidget() {
  const { widgetId } = Route.useParams()
  const id = Number(widgetId)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const widgetQuery = useQuery({
    queryKey: ['widgets', id],
    queryFn: () => api.widgets.get(id),
  })

  const saveWidget = useMutation({
    mutationFn: (input: CustomWidgetInput) => api.widgets.update(id, input),
    onSuccess: (widget) => {
      queryClient.setQueryData(['widgets', id], widget)
      void queryClient.invalidateQueries({ queryKey: ['widgets'] })
      void navigate({ to: '/widgets' })
    },
  })

  if (widgetQuery.error) {
    return (
      <p className="text-destructive text-sm">
        Could not load that widget: {widgetQuery.error.message}
      </p>
    )
  }
  if (!widgetQuery.data) {
    return (
      <section>
        <h1 className="mb-6 font-semibold text-2xl tracking-tight">Edit widget</h1>
        <Skeleton className="h-96 w-full" />
      </section>
    )
  }

  return (
    <section>
      <h1 className="mb-6 font-semibold text-2xl tracking-tight">{widgetQuery.data.name}</h1>
      {/* Keyed on the loaded widget so the editor's draft state is seeded from
          it exactly once — without this, navigating between two widgets would
          reuse the first one's draft. */}
      <WidgetEditor
        key={widgetQuery.data.id}
        widget={widgetQuery.data}
        saving={saveWidget.isPending}
        saveError={saveWidget.error}
        onSave={(input) => saveWidget.mutate(input)}
        onCancel={() => navigate({ to: '/widgets' })}
      />
    </section>
  )
}
