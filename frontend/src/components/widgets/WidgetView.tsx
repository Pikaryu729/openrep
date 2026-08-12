import { WIDGET_CATALOG, type WidgetInstance } from '@/lib/dashboard'
import {
  CategoryBreakdownWidget,
  CustomWidget,
  ExerciseProgressWidget,
  PersonalRecordsWidget,
  RecentWorkoutsWidget,
  StatTilesWidget,
  VolumeChartWidget,
} from './Widgets'

/**
 * The one place a widget type becomes a component. The switch narrows the
 * discriminated union, so adding a member to WidgetInstance makes the compiler
 * flag this file (and WidgetOptionsForm) until it is handled.
 */
export function WidgetView({ widget }: { widget: WidgetInstance }) {
  switch (widget.type) {
    case 'stat_tiles':
      return <StatTilesWidget options={widget.options} />
    case 'volume_chart':
      return <VolumeChartWidget options={widget.options} />
    case 'personal_records':
      return <PersonalRecordsWidget options={widget.options} />
    case 'exercise_progress':
      return <ExerciseProgressWidget options={widget.options} />
    case 'recent_workouts':
      return <RecentWorkoutsWidget options={widget.options} />
    case 'category_breakdown':
      return <CategoryBreakdownWidget options={widget.options} />
    case 'custom':
      return <CustomWidget options={widget.options} />
  }
}

/**
 * Card title for a widget, including whatever its options pin it to.
 *
 * A custom widget is titled by the *user's* name for it, not the catalog
 * label: "Your widget" on every card would be useless. `pinnedName` is the
 * exercise name for a pinned built-in, or the widget name for a custom one.
 */
export function widgetTitle(widget: WidgetInstance, pinnedName?: string | null): string {
  if (widget.type === 'custom') return pinnedName || WIDGET_CATALOG.custom.label
  const base = WIDGET_CATALOG[widget.type].label
  if (widget.type === 'exercise_progress' && pinnedName) return `${base} · ${pinnedName}`
  return base
}
