import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { WidgetEditor } from '@/components/WidgetEditor'
import { api, type CustomWidgetInput } from '@/lib/api'

export const Route = createFileRoute('/widgets/new')({
  component: NewWidget,
})

export function NewWidget() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const createWidget = useMutation({
    mutationFn: (input: CustomWidgetInput) => api.widgets.create(input),
    onSuccess: (widget) => {
      void queryClient.invalidateQueries({ queryKey: ['widgets'] })
      // Land on the saved widget rather than the list: the next thing you do
      // after building one is look at it, and often adjust it once more.
      void navigate({ to: '/widgets/$widgetId', params: { widgetId: String(widget.id) } })
    },
  })

  return (
    <section>
      <h1 className="mb-6 font-semibold text-2xl tracking-tight">Create a widget</h1>
      <WidgetEditor
        saving={createWidget.isPending}
        saveError={createWidget.error}
        onSave={(input) => createWidget.mutate(input)}
        onCancel={() => navigate({ to: '/widgets' })}
      />
    </section>
  )
}
