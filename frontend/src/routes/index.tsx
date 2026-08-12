import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EmptyState } from '@/components/EmptyState'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { WidgetFrame } from '@/components/widgets/WidgetFrame'
import { WidgetView, widgetTitle } from '@/components/widgets/WidgetView'
import { api } from '@/lib/api'
import {
  DEFAULT_WIDGETS,
  WIDGET_CATALOG,
  buildDashboardFile,
  createWidget,
  fromFileWidgets,
  moveWidget,
  nextWidgetId,
  parseDashboardFile,
  toConfigPayload,
  widgetsFromConfig,
  type WidgetInstance,
  type WidgetType,
} from '@/lib/dashboard'

/** The union member the Add dialog builds by hand: `custom` is not offered as
 * a bare type, only as one of the user's saved widgets. */
const BUILT_IN_TYPES = (Object.keys(WIDGET_CATALOG) as WidgetType[]).filter(
  (type) => type !== 'custom',
)

export const Route = createFileRoute('/')({
  component: Dashboard,
})

interface PendingImport {
  widgets: WidgetInstance[]
  fileName: string
  dropped: number
  unresolved: string[]
}

export function Dashboard() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // draft !== null IS edit mode: one piece of state, so there is no separate
  // flag that can drift out of sync with it.
  const [draft, setDraft] = useState<WidgetInstance[] | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)

  const configQuery = useQuery({
    queryKey: ['dashboard', 'config'],
    queryFn: api.dashboard.getConfig,
  })
  // Both are needed to swap ids for names on export and to title pinned
  // widgets — a custom placement is titled by the user's name for it.
  const exercisesQuery = useQuery({ queryKey: ['exercises'], queryFn: api.exercises.list })
  const customWidgetsQuery = useQuery({ queryKey: ['widgets'], queryFn: api.widgets.list })

  const saveConfig = useMutation({
    mutationFn: (widgets: WidgetInstance[]) => api.dashboard.saveConfig(toConfigPayload(widgets)),
    onSuccess: (config) => {
      queryClient.setQueryData(['dashboard', 'config'], config)
      setDraft(null)
    },
    // Deliberately no draft reset on error: a failed write must never cost the
    // user their edits.
  })

  if (configQuery.error) {
    return (
      <p className="text-destructive text-sm">
        Could not load your dashboard: {configQuery.error.message}
      </p>
    )
  }
  if (!configQuery.data) {
    return (
      <section>
        <h1 className="mb-6 font-semibold text-2xl tracking-tight">Dashboard</h1>
        <Skeleton className="h-24 w-full" />
      </section>
    )
  }

  const stored = widgetsFromConfig(configQuery.data)
  const saved = stored.widgets
  const editing = draft !== null
  const shown = draft ?? saved
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(saved)
  const exercises = exercisesQuery.data ?? []
  const customWidgets = customWidgetsQuery.data ?? []
  const nameIn = (rows: { id: number; name: string }[], id: number | null) =>
    id == null ? null : (rows.find((row) => row.id === id)?.name ?? null)
  /** The name a widget's options pin it to, whichever table that lives in. */
  const pinnedName = (widget: WidgetInstance) => {
    if (widget.type === 'exercise_progress') return nameIn(exercises, widget.options.exercise_id)
    if (widget.type === 'custom') return nameIn(customWidgets, widget.options.widget_id)
    return null
  }

  const exportLayout = () => {
    const file = buildDashboardFile(shown, { exercises, customWidgets })
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = `openrep-dashboard-${file.exported_at.slice(0, 10)}.json`
    // Firefox only honours a programmatic click on an anchor that is in the
    // document, and revoking in the same tick races the browser's blob fetch.
    window.document.body.append(anchor)
    anchor.click()
    anchor.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const onFileChosen = async (file: File) => {
    setFileError(null)
    // Contents are in hand, so clear the input immediately: an unchanged value
    // fires no change event, and re-picking a file is exactly what you do next.
    if (fileInputRef.current) fileInputRef.current.value = ''
    try {
      const parsed = parseDashboardFile(JSON.parse(await file.text()))
      if (!parsed) {
        setFileError('This file is not an OpenRep v1 dashboard layout.')
        return
      }
      const result = fromFileWidgets(parsed.widgets, { exercises, customWidgets })
      setPendingImport({
        widgets: result.widgets,
        fileName: file.name,
        dropped: result.dropped,
        unresolved: result.unresolved,
      })
    } catch {
      setFileError('Could not read that file as JSON.')
    }
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-semibold text-2xl tracking-tight">Dashboard</h1>
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              Add widget
            </Button>
            <Button variant="outline" size="sm" onClick={exportLayout}>
              Export layout
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              Import layout
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmingReset(true)}>
              Reset to default
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (dirty ? setConfirmingCancel(true) : setDraft(null))}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!dirty || saveConfig.isPending}
              onClick={() => draft && saveConfig.mutate(draft)}
            >
              Save
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setDraft(saved)}>
            Edit dashboard
          </Button>
        )}
      </div>

      {/* Hidden so the toolbar button owns the affordance; kept mounted so the
          ref is always there to click. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        aria-label="Dashboard layout file"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void onFileChosen(file)
        }}
      />

      {saveConfig.error && (
        <p className="mb-4 text-destructive text-sm">
          Could not save your dashboard: {saveConfig.error.message}
        </p>
      )}
      {fileError && <p className="mb-4 text-destructive text-sm">{fileError}</p>}
      {stored.dropped > 0 && (
        <p className="mb-4 text-muted-foreground text-sm">
          {stored.dropped} widget{stored.dropped === 1 ? '' : 's'} from a newer version of OpenRep
          cannot be shown. Saving will remove {stored.dropped === 1 ? 'it' : 'them'}.
        </p>
      )}

      {shown.length === 0 ? (
        <EmptyState
          title="Your dashboard is empty"
          hint="Add a widget to see your training at a glance."
          action={
            <Button
              variant="outline"
              onClick={() => {
                if (!editing) setDraft(saved)
                setAdding(true)
              }}
            >
              Add widgets
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-4">
          {shown.map((widget, index) => (
            <WidgetFrame
              key={widget.id}
              widget={widget}
              title={widgetTitle(widget, pinnedName(widget))}
              editing={editing}
              canMoveUp={index > 0}
              canMoveDown={index < shown.length - 1}
              onMove={(delta) => setDraft(moveWidget(shown, index, delta))}
              onRemove={() => setDraft(shown.filter((entry) => entry.id !== widget.id))}
              onChange={(next) =>
                setDraft(shown.map((entry) => (entry.id === widget.id ? next : entry)))
              }
            >
              <WidgetView widget={widget} />
            </WidgetFrame>
          ))}
        </div>
      )}

      {adding && (
        <Modal title="Add widget" onClose={() => setAdding(false)}>
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-muted-foreground text-sm">Your widgets</h3>
                {/* The way out of the fixed catalog. Leaving edit mode without
                    saving would cost the draft, so the layout is saved first
                    when there is something to save. */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (dirty && draft) saveConfig.mutate(draft)
                    void navigate({ to: '/widgets/new' })
                  }}
                >
                  Create widget
                </Button>
              </div>
              {customWidgets.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Build your own widget to ask a question these don't answer — any metric, grouped
                  and filtered how you want.
                </p>
              ) : (
                <ul className="flex list-none flex-col gap-2 p-0">
                  {customWidgets.map((custom) => (
                    <li
                      key={custom.id}
                      className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{custom.name}</p>
                        {custom.description && (
                          <p className="truncate text-muted-foreground text-sm">
                            {custom.description}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        aria-label={`Add ${custom.name}`}
                        onClick={() => {
                          const widget = createWidget('custom')
                          setDraft([
                            ...shown,
                            { ...widget, options: { widget_id: custom.id } } as WidgetInstance,
                          ])
                          setAdding(false)
                        }}
                      >
                        Add
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="font-medium text-muted-foreground text-sm">Built in</h3>
              <ul className="flex list-none flex-col gap-2 p-0">
                {BUILT_IN_TYPES.map((type) => (
                  <li
                    key={type}
                    className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{WIDGET_CATALOG[type].label}</p>
                      <p className="text-muted-foreground text-sm">
                        {WIDGET_CATALOG[type].description}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label={`Add ${WIDGET_CATALOG[type].label}`}
                      onClick={() => {
                        setDraft([...shown, createWidget(type)])
                        setAdding(false)
                      }}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </Modal>
      )}

      {confirmingCancel && (
        <ConfirmDialog
          title="Discard dashboard changes?"
          message="Your edits since the last save will be lost."
          confirmLabel="Discard"
          danger
          onConfirm={() => {
            setDraft(null)
            setConfirmingCancel(false)
          }}
          onCancel={() => setConfirmingCancel(false)}
        />
      )}

      {confirmingReset && (
        <ConfirmDialog
          title="Reset to the default dashboard?"
          message="This replaces your layout with the default widgets. You still have to save."
          confirmLabel="Reset"
          danger
          onConfirm={() => {
            setDraft(DEFAULT_WIDGETS.map((widget) => ({ ...widget, id: nextWidgetId() })))
            setConfirmingReset(false)
          }}
          onCancel={() => setConfirmingReset(false)}
        />
      )}

      {pendingImport && (
        <ConfirmDialog
          title="Replace your dashboard layout?"
          message={[
            `"${pendingImport.fileName}" has ${pendingImport.widgets.length} widget${
              pendingImport.widgets.length === 1 ? '' : 's'
            }.`,
            pendingImport.dropped > 0
              ? `${pendingImport.dropped} from a newer version will be dropped.`
              : '',
            pendingImport.unresolved.length > 0
              ? `You don't have ${pendingImport.unresolved.join(', ')}, so those widgets need setting up.`
              : '',
            'You still have to save.',
          ]
            .filter(Boolean)
            .join(' ')}
          confirmLabel="Replace layout"
          danger
          onConfirm={() => {
            setDraft(pendingImport.widgets)
            setPendingImport(null)
          }}
          onCancel={() => setPendingImport(null)}
        />
      )}
    </section>
  )
}
