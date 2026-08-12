import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { NativeSelect } from '@/components/NativeSelect'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { CustomWidgetResult } from '@/components/widgets/CustomWidgetView'
import {
  api,
  type CustomWidget,
  type CustomWidgetInput,
  type GroupBy,
  type QueryCatalog,
  type QueryFieldInfo,
  type QueryFilter,
  type QueryMetric,
  type Visualization,
  type WidgetQuery,
} from '@/lib/api'
import {
  aggNeedsField,
  blankFilter,
  blankMetric,
  blankQuery,
  coerceFilterValue,
  describeQuery,
  metricLabel,
  opNeedsValue,
  opTakesList,
  queryProblems,
  rangeLabelForDays,
  startDateForDays,
} from '@/lib/widgetQuery'

/**
 * The widget editor.
 *
 * Structured as a form on the left and a live preview on the right, because
 * the only way to know whether a query says what you meant is to see its
 * answer. Every edit re-runs it against your real data via /widgets/preview —
 * nothing is saved until you say so.
 *
 * The form renders itself from the catalog the server publishes, so the set of
 * fields, operators, and aggregates has exactly one definition
 * (backend/openrep/schemas/widget_query.py) rather than a copy here that
 * drifts.
 */

export interface WidgetDraft {
  name: string
  description: string
  visualization: Visualization
  query: WidgetQuery
}

function draftFrom(widget?: CustomWidget): WidgetDraft {
  return {
    name: widget?.name ?? '',
    description: widget?.description ?? '',
    visualization: widget?.visualization ?? 'bar',
    query: widget?.query ?? blankQuery(),
  }
}

export function toWidgetInput(draft: WidgetDraft): CustomWidgetInput {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    visualization: draft.visualization,
    query: draft.query,
  }
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}

/** A row of controls with a Remove button pinned to the end. */
function EditorRow({ onRemove, label, children }: {
  onRemove: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <li className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-3">
      {children}
      <Button variant="ghost" size="sm" aria-label={label} onClick={onRemove}>
        Remove
      </Button>
    </li>
  )
}

// --- filter value inputs ----------------------------------------------------

/**
 * Exercises and categories get pickers rather than free text: they are the two
 * filters people actually reach for, and typing an exercise name from memory
 * is how you get a widget that silently matches nothing.
 */
function FilterValueInput({
  filter,
  field,
  onChange,
}: {
  filter: QueryFilter
  field: QueryFieldInfo
  onChange: (value: QueryFilter['value']) => void
}) {
  const { data: exercises } = useQuery({ queryKey: ['exercises'], queryFn: api.exercises.list })

  if (!opNeedsValue(filter.op)) return null

  if (opTakesList(filter.op)) {
    const values = Array.isArray(filter.value) ? filter.value : []
    return (
      <Field label="Values" hint="Comma separated.">
        <Input
          aria-label="Values"
          className="w-56"
          value={values.join(', ')}
          onChange={(event) => {
            const parts = event.target.value
              .split(',')
              .map((part) => part.trim())
              .filter(Boolean)
            onChange(field.kind === 'number' ? parts.map(Number).filter(Number.isFinite) : parts)
          }}
        />
      </Field>
    )
  }

  if (field.key === 'exercise_id') {
    return (
      <Field label="Value">
        <NativeSelect
          aria-label="Value"
          value={String(filter.value ?? '')}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          <option value="">Choose an exercise…</option>
          {exercises?.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
    )
  }

  if (field.key === 'category' && filter.op === 'eq') {
    // Categories are free text, so the choices are whatever the library uses.
    const categories = [...new Set(exercises?.map((exercise) => exercise.category) ?? [])].sort()
    return (
      <Field label="Value">
        <NativeSelect
          aria-label="Value"
          value={String(filter.value ?? '')}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Choose a category…</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </NativeSelect>
      </Field>
    )
  }

  return (
    <Field label="Value">
      <Input
        aria-label="Value"
        className="w-40"
        type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
        value={filter.value == null ? '' : String(filter.value)}
        onChange={(event) =>
          onChange(field.kind === 'number' ? Number(event.target.value) : event.target.value)
        }
      />
    </Field>
  )
}

// --- the editor -------------------------------------------------------------

export function WidgetEditor({
  widget,
  saving,
  saveError,
  onSave,
  onCancel,
}: {
  widget?: CustomWidget
  saving: boolean
  saveError: Error | null
  onSave: (input: CustomWidgetInput) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<WidgetDraft>(() => draftFrom(widget))

  const catalogQuery = useQuery({
    queryKey: ['widgets', 'catalog'],
    queryFn: api.widgets.catalog,
    // The query language only changes when the server does.
    staleTime: Number.POSITIVE_INFINITY,
  })

  if (catalogQuery.error) {
    return (
      <p className="text-destructive text-sm">
        Could not load the widget editor: {catalogQuery.error.message}
      </p>
    )
  }
  if (!catalogQuery.data) return <Skeleton className="h-96 w-full" />

  return (
    <EditorBody
      catalog={catalogQuery.data}
      draft={draft}
      setDraft={setDraft}
      saving={saving}
      saveError={saveError}
      onSave={onSave}
      onCancel={onCancel}
      isNew={widget === undefined}
    />
  )
}

function EditorBody({
  catalog,
  draft,
  setDraft,
  saving,
  saveError,
  onSave,
  onCancel,
  isNew,
}: {
  catalog: QueryCatalog
  draft: WidgetDraft
  setDraft: (draft: WidgetDraft) => void
  saving: boolean
  saveError: Error | null
  onSave: (input: CustomWidgetInput) => void
  onCancel: () => void
  isNew: boolean
}) {
  const { query } = draft
  const fieldsByKey = useMemo(
    () => new Map(catalog.fields.map((field) => [field.key, field])),
    [catalog],
  )

  const setQuery = (next: Partial<WidgetQuery>) => setDraft({ ...draft, query: { ...query, ...next } })

  const problems = queryProblems(query, catalog)
  const named = draft.name.trim().length > 0
  const canSave = named && problems.length === 0 && !saving

  // --- live preview ---------------------------------------------------------
  // Keyed on the query itself, so every edit re-runs it and an unchanged edit
  // (retyping the same label) is served from cache. Only run it once the query
  // is actually valid — a half-built one would just be a 422 in the panel.
  const start = startDateForDays(query.range_days)
  const previewQuery = useQuery({
    queryKey: ['widgets', 'preview', query, start],
    queryFn: () => api.widgets.preview(query, { start }),
    enabled: problems.length === 0,
    placeholderData: (previous) => previous,
  })

  const updateMetric = (index: number, patch: Partial<QueryMetric>) => {
    const metrics = query.metrics.map((metric, position) =>
      position === index ? { ...metric, ...patch } : metric,
    )
    setQuery({ metrics })
  }

  const removeMetric = (index: number) => {
    const metrics = query.metrics.filter((_metric, position) => position !== index)
    // Sorting by a metric that no longer exists is not a state the user can
    // fix from this form, so fall back rather than leaving it dangling.
    const sortStillValid = metrics.some((metric) => metric.key === query.sort.by)
    setQuery({
      metrics,
      sort: sortStillValid ? query.sort : { by: 'group', direction: 'asc' },
    })
  }

  const updateFilter = (index: number, patch: Partial<QueryFilter>) => {
    const filters = query.filters.map((filter, position) => {
      if (position !== index) return filter
      const merged = { ...filter, ...patch }
      const field = fieldsByKey.get(merged.field)
      // A field or operator change can strand a value of the wrong shape.
      return field ? { ...merged, value: coerceFilterValue(merged, field) } : merged
    })
    setQuery({ filters })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>Name</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Field label="Widget name">
              <Input
                aria-label="Widget name"
                value={draft.name}
                placeholder="Weekly squat tonnage"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </Field>
            <Field label="Description" hint="Optional. Shown in your widget list.">
              <Input
                aria-label="Description"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>Measure</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <ul className="flex list-none flex-col gap-2 p-0">
              {query.metrics.map((metric, index) => {
                const field = metric.field ? fieldsByKey.get(metric.field) : undefined
                const aggregates = catalog.aggregates.filter(
                  (choice) =>
                    choice.value === 'count' ||
                    catalog.fields.some((entry) =>
                      entry.aggregates.includes(choice.value as QueryMetric['agg']),
                    ),
                )
                const fieldChoices = catalog.fields.filter((entry) =>
                  entry.aggregates.includes(metric.agg),
                )

                return (
                  <EditorRow
                    key={metric.key}
                    label={`Remove ${metricLabel(metric, catalog)}`}
                    onRemove={() => removeMetric(index)}
                  >
                    <Field label="Aggregate">
                      <NativeSelect
                        aria-label="Aggregate"
                        value={metric.agg}
                        onChange={(event) => {
                          const agg = event.target.value as QueryMetric['agg']
                          // Keep the field only if the new aggregate accepts it.
                          const keeps =
                            field?.aggregates.includes(agg) && aggNeedsField(agg)
                              ? metric.field
                              : (catalog.fields.find((entry) => entry.aggregates.includes(agg))
                                  ?.key ?? null)
                          updateMetric(index, { agg, field: aggNeedsField(agg) ? keeps : null })
                        }}
                      >
                        {aggregates.map((choice) => (
                          <option key={choice.value} value={choice.value}>
                            {choice.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    {aggNeedsField(metric.agg) && (
                      <Field label="Of">
                        <NativeSelect
                          aria-label="Of"
                          value={metric.field ?? ''}
                          onChange={(event) => updateMetric(index, { field: event.target.value })}
                        >
                          {fieldChoices.map((entry) => (
                            <option key={entry.key} value={entry.key}>
                              {entry.label}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                    )}
                    <Field label="Label">
                      <Input
                        aria-label="Label"
                        className="w-40"
                        placeholder={metricLabel({ ...metric, label: null }, catalog)}
                        value={metric.label ?? ''}
                        onChange={(event) =>
                          updateMetric(index, { label: event.target.value || null })
                        }
                      />
                    </Field>
                  </EditorRow>
                )
              })}
            </ul>
            <div>
              <Button
                variant="outline"
                size="sm"
                disabled={query.metrics.length >= catalog.max_metrics}
                onClick={() =>
                  setQuery({ metrics: [...query.metrics, blankMetric(query.metrics, catalog)] })
                }
              >
                Add metric
              </Button>
              {query.metrics.length >= catalog.max_metrics && (
                <span className="ml-2 text-muted-foreground text-xs">
                  {catalog.max_metrics} is the limit.
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>Break down</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <Field label="Group by">
              <NativeSelect
                aria-label="Group by"
                value={query.group_by}
                onChange={(event) => setQuery({ group_by: event.target.value as GroupBy })}
              >
                {catalog.group_by.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label="Time range">
              <NativeSelect
                aria-label="Time range"
                value={String(query.range_days ?? '')}
                onChange={(event) =>
                  setQuery({ range_days: event.target.value ? Number(event.target.value) : null })
                }
              >
                <option value="">All time</option>
                {catalog.range_days.map((days) => (
                  <option key={days} value={days}>
                    {rangeLabelForDays(days)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            {/* One row means there is nothing to order or trim. */}
            {query.group_by !== 'none' && (
              <>
                <Field label="Sort by">
                  <NativeSelect
                    aria-label="Sort by"
                    value={query.sort.by}
                    onChange={(event) =>
                      setQuery({ sort: { ...query.sort, by: event.target.value } })
                    }
                  >
                    <option value="group">Group</option>
                    {query.metrics.map((metric) => (
                      <option key={metric.key} value={metric.key}>
                        {metricLabel(metric, catalog)}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field label="Direction">
                  <NativeSelect
                    aria-label="Direction"
                    value={query.sort.direction}
                    onChange={(event) =>
                      setQuery({
                        sort: { ...query.sort, direction: event.target.value as 'asc' | 'desc' },
                      })
                    }
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </NativeSelect>
                </Field>
                <Field label="Show">
                  <NativeSelect
                    aria-label="Show"
                    value={String(query.limit ?? '')}
                    onChange={(event) =>
                      setQuery({ limit: event.target.value ? Number(event.target.value) : null })
                    }
                  >
                    <option value="">Everything</option>
                    {[3, 5, 10, 20, 50].map((count) => (
                      <option key={count} value={count}>
                        Top {count}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>Filter</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {query.filters.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No filters — this widget looks at every set you have logged.
              </p>
            )}
            <ul className="flex list-none flex-col gap-2 p-0">
              {query.filters.map((filter, index) => {
                const field = fieldsByKey.get(filter.field)
                return (
                  <EditorRow
                    key={`${filter.field}-${index}`}
                    label={`Remove ${field?.label ?? filter.field} filter`}
                    onRemove={() =>
                      setQuery({
                        filters: query.filters.filter((_entry, position) => position !== index),
                      })
                    }
                  >
                    <Field label="Field">
                      <NativeSelect
                        aria-label="Field"
                        value={filter.field}
                        onChange={(event) => {
                          const next = fieldsByKey.get(event.target.value)
                          updateFilter(index, {
                            field: event.target.value,
                            // The old operator may not be legal on the new field.
                            op: next?.ops.includes(filter.op) ? filter.op : (next?.ops[0] ?? 'eq'),
                          })
                        }}
                      >
                        {catalog.fields.map((entry) => (
                          <option key={entry.key} value={entry.key}>
                            {entry.label}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field label="Condition">
                      <NativeSelect
                        aria-label="Condition"
                        value={filter.op}
                        onChange={(event) =>
                          updateFilter(index, { op: event.target.value as QueryFilter['op'] })
                        }
                      >
                        {(field?.ops ?? []).map((op) => (
                          <option key={op} value={op}>
                            {OP_LABELS[op]}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    {field && (
                      <FilterValueInput
                        filter={filter}
                        field={field}
                        onChange={(value) => updateFilter(index, { value })}
                      />
                    )}
                  </EditorRow>
                )
              })}
            </ul>
            <div>
              <Button
                variant="outline"
                size="sm"
                disabled={query.filters.length >= catalog.max_filters}
                onClick={() => setQuery({ filters: [...query.filters, blankFilter(catalog)] })}
              >
                Add filter
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>Show it as</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Field
              label="Visualization"
              hint={VISUALIZATION_HINTS[draft.visualization]}
            >
              <NativeSelect
                aria-label="Visualization"
                value={draft.visualization}
                onChange={(event) =>
                  setDraft({ ...draft, visualization: event.target.value as Visualization })
                }
              >
                {catalog.visualizations.map((choice) => (
                  <option key={choice.value} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </CardContent>
        </Card>
      </div>

      {/* Sticky so the preview stays in view while the form scrolls past it. */}
      <div className="flex flex-col gap-4 lg:sticky lg:top-4">
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>{draft.name.trim() || 'Preview'}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-muted-foreground text-sm">{describeQuery(query, catalog)}</p>
            {problems.length > 0 ? (
              <ul className="flex list-none flex-col gap-1 p-0 text-muted-foreground text-sm">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : previewQuery.error ? (
              <p className="text-destructive text-sm">
                This query could not run: {previewQuery.error.message}
              </p>
            ) : !previewQuery.data ? (
              <Skeleton className="h-64 w-full" />
            ) : previewQuery.data.rows.length === 0 ? (
              <EmptyState
                title="Nothing matches"
                hint="No sets in your log match this query. Try a wider time range or fewer filters."
              />
            ) : (
              <CustomWidgetResult widget={draft} result={previewQuery.data} />
            )}
          </CardContent>
        </Card>

        {saveError && (
          <p className="text-destructive text-sm">Could not save: {saveError.message}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!canSave} onClick={() => onSave(toWidgetInput(draft))}>
            {saving ? 'Saving…' : isNew ? 'Create widget' : 'Save changes'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {!named && <span className="text-muted-foreground text-sm">Give your widget a name.</span>}
        </div>
      </div>
    </div>
  )
}

const OP_LABELS: Record<QueryFilter['op'], string> = {
  eq: 'is',
  ne: 'is not',
  gt: 'is more than',
  gte: 'is at least',
  lt: 'is less than',
  lte: 'is at most',
  in: 'is one of',
  contains: 'contains',
  is_null: 'is blank',
  not_null: 'is not blank',
}

const VISUALIZATION_HINTS: Record<Visualization, string> = {
  bar: 'Best for comparing magnitude across groups.',
  line: 'Best for change over time. Gaps stay gaps — a group with no data is not a zero.',
  table: 'Exact numbers, every group, every metric.',
  stat: 'The headline number. With a grouping, that is the first row after sorting.',
}
