import { useQuery } from '@tanstack/react-query'
import { NativeSelect } from '@/components/NativeSelect'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { STAT_METRICS, type RangeDays, type StatMetric, type WidgetInstance } from '@/lib/dashboard'
import { rangeLabel } from './widgetData'

const RANGE_CHOICES: RangeDays[] = [30, 90, 365, null]
const METRIC_LABELS: Record<StatMetric, string> = {
  sessions: 'Sessions',
  sets: 'Sets logged',
  volume: 'Total volume',
  last_session: 'Last session',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function RangeField({
  value,
  onChange,
}: {
  value: RangeDays
  onChange: (value: RangeDays) => void
}) {
  return (
    <Field label="Range">
      <NativeSelect
        aria-label="Range"
        value={String(value)}
        onChange={(event) =>
          onChange(event.target.value === 'null' ? null : (Number(event.target.value) as RangeDays))
        }
      >
        {RANGE_CHOICES.map((choice) => (
          <option key={String(choice)} value={String(choice)}>
            {rangeLabel(choice)}
          </option>
        ))}
      </NativeSelect>
    </Field>
  )
}

function LimitField({
  value,
  choices,
  onChange,
}: {
  value: number
  choices: number[]
  onChange: (value: number) => void
}) {
  return (
    <Field label="Rows">
      <NativeSelect
        aria-label="Rows"
        value={String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {choices.map((choice) => (
          <option key={choice} value={choice}>
            {choice}
          </option>
        ))}
      </NativeSelect>
    </Field>
  )
}

function ExerciseField({
  value,
  onChange,
  allowAny,
}: {
  value: number | null
  onChange: (value: number | null) => void
  allowAny: boolean
}) {
  const { data: exercises } = useQuery({ queryKey: ['exercises'], queryFn: api.exercises.list })

  return (
    <Field label="Exercise">
      <NativeSelect
        aria-label="Exercise"
        value={value == null ? '' : String(value)}
        onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}
      >
        <option value="">{allowAny ? 'Any exercise' : 'Choose an exercise…'}</option>
        {exercises?.map((exercise) => (
          <option key={exercise.id} value={exercise.id}>
            {exercise.name}
          </option>
        ))}
      </NativeSelect>
    </Field>
  )
}

function CategoryField({
  value,
  onChange,
}: {
  value: string | null
  onChange: (value: string | null) => void
}) {
  const { data: exercises } = useQuery({ queryKey: ['exercises'], queryFn: api.exercises.list })
  // Categories are free text, so the choices are whatever the library actually uses.
  const categories = [...new Set(exercises?.map((exercise) => exercise.category) ?? [])].sort()

  return (
    <Field label="Category">
      <NativeSelect
        aria-label="Category"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">Any category</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </NativeSelect>
    </Field>
  )
}

/**
 * The second exhaustive switch over the widget union. Options are one or two
 * fields each, so they render inline in the widget's frame rather than stacking
 * a dialog inside edit mode.
 */
export function WidgetOptionsForm({
  widget,
  onChange,
}: {
  widget: WidgetInstance
  onChange: (widget: WidgetInstance) => void
}) {
  switch (widget.type) {
    case 'stat_tiles': {
      const { metrics } = widget.options
      return (
        <div className="flex flex-wrap gap-4">
          {STAT_METRICS.map((metric) => {
            const checked = metrics.includes(metric)
            // Never let the last tile be unchecked: an empty tile row is not a
            // configuration anyone wants, it just looks broken.
            const isLast = checked && metrics.length === 1
            return (
              <label key={metric} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={checked}
                  disabled={isLast}
                  onChange={() =>
                    onChange({
                      ...widget,
                      options: {
                        metrics: checked
                          ? metrics.filter((m) => m !== metric)
                          : STAT_METRICS.filter((m) => m === metric || metrics.includes(m)),
                      },
                    })
                  }
                />
                {METRIC_LABELS[metric]}
              </label>
            )
          })}
        </div>
      )
    }
    case 'volume_chart':
      return (
        <RangeField
          value={widget.options.range_days}
          onChange={(range_days) => onChange({ ...widget, options: { range_days } })}
        />
      )
    case 'personal_records':
      return (
        <LimitField
          value={widget.options.limit}
          choices={[3, 5, 10]}
          onChange={(limit) => onChange({ ...widget, options: { limit } })}
        />
      )
    case 'exercise_progress':
      return (
        <ExerciseField
          allowAny={false}
          value={widget.options.exercise_id}
          onChange={(exercise_id) => onChange({ ...widget, options: { exercise_id } })}
        />
      )
    case 'recent_workouts':
      return (
        <div className="flex flex-wrap items-end gap-3">
          <LimitField
            value={widget.options.limit}
            choices={[5, 10, 20]}
            onChange={(limit) => onChange({ ...widget, options: { ...widget.options, limit } })}
          />
          <RangeField
            value={widget.options.range_days}
            onChange={(range_days) =>
              onChange({ ...widget, options: { ...widget.options, range_days } })
            }
          />
          <ExerciseField
            allowAny
            value={widget.options.exercise_id}
            onChange={(exercise_id) =>
              onChange({ ...widget, options: { ...widget.options, exercise_id } })
            }
          />
          <CategoryField
            value={widget.options.category}
            onChange={(category) =>
              onChange({ ...widget, options: { ...widget.options, category } })
            }
          />
        </div>
      )
    case 'category_breakdown':
      return (
        <div className="flex flex-wrap items-end gap-3">
          <RangeField
            value={widget.options.range_days}
            onChange={(range_days) =>
              onChange({ ...widget, options: { ...widget.options, range_days } })
            }
          />
          <Field label="Categories">
            <NativeSelect
              aria-label="Categories"
              value={String(widget.options.max_categories)}
              onChange={(event) =>
                onChange({
                  ...widget,
                  options: { ...widget.options, max_categories: Number(event.target.value) },
                })
              }
            >
              {[5, 8, 10].map((choice) => (
                <option key={choice} value={choice}>
                  Top {choice}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      )
  }
}
