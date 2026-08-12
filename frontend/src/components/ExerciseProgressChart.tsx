import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import type { SetHistoryPoint } from '@/lib/api'
import { shortDate } from '@/lib/format'
import { kgToDisplay, type UnitSystem, weightUnit } from '@/lib/units'

export interface SessionPoint {
  performed_on: string
  top_weight: number
  best_e1rm: number
}

/**
 * One point per session, not per set: the API returns every set, and plotting
 * all of them puts several marks on one x value, which reads as noise rather
 * than progress.
 */
export function toSessionPoints(history: SetHistoryPoint[], units: UnitSystem): SessionPoint[] {
  const byDay = new Map<string, SessionPoint>()
  for (const point of history) {
    const existing = byDay.get(point.performed_on)
    const weight = kgToDisplay(point.weight_kg, units)
    const e1rm = kgToDisplay(point.estimated_1rm_kg, units)
    if (!existing) {
      byDay.set(point.performed_on, {
        performed_on: point.performed_on,
        top_weight: weight,
        best_e1rm: e1rm,
      })
    } else {
      existing.top_weight = Math.max(existing.top_weight, weight)
      existing.best_e1rm = Math.max(existing.best_e1rm, e1rm)
    }
  }
  return [...byDay.values()].sort((a, b) => a.performed_on.localeCompare(b.performed_on))
}

/**
 * Heaviest set and best estimated 1RM per session, on one axis.
 *
 * Both series are kilograms (or pounds), so they share a scale — never a second
 * y-axis. The series are told apart by dash pattern as well as hue: the default
 * "graphite" accent is a near-neutral gray (OKLCH chroma 0.012), so hue alone
 * would collapse against the muted grey of the context series.
 */
export function ExerciseProgressChart({
  data,
  units,
}: {
  data: SessionPoint[]
  units: UnitSystem
}) {
  const unit = weightUnit(units)

  // Lines encode position, not magnitude, so they need no zero baseline — and
  // forcing one here squashes a season of progress into the top third of the
  // plot. (Bars are the opposite: VolumeChart keeps its zero baseline.)
  const values = data.flatMap((point) => [point.top_weight, point.best_e1rm])
  const low = values.length ? Math.min(...values) : 0
  const high = values.length ? Math.max(...values) : 1
  const pad = Math.max(2, (high - low) * 0.15)
  const domain: [number, number] = [Math.max(0, Math.floor(low - pad)), Math.ceil(high + pad)]

  return (
    <ChartContainer
      className="h-72 w-full"
      config={{
        best_e1rm: { label: `Est. 1RM (${unit})`, color: 'var(--accent)' },
        top_weight: { label: `Top set (${unit})`, color: 'var(--muted-foreground)' },
      }}
    >
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="performed_on"
          tickFormatter={shortDate}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
        />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={48} domain={domain} />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={(label) => shortDate(String(label))} />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        {/* Context first so the headline series draws over it. */}
        <Line
          dataKey="top_weight"
          type="monotone"
          stroke="var(--color-top_weight)"
          strokeWidth={2}
          strokeDasharray="4 4"
          // fill matters: a dot with only a surface-coloured ring punches holes
          // in the line it sits on, which reads as a broken series.
          dot={{ r: 3, fill: 'var(--color-top_weight)', strokeWidth: 2, stroke: 'var(--card)' }}
          activeDot={{ r: 5, fill: 'var(--color-top_weight)', strokeWidth: 2, stroke: 'var(--card)' }}
        />
        <Line
          dataKey="best_e1rm"
          type="monotone"
          stroke="var(--color-best_e1rm)"
          strokeWidth={2}
          dot={{ r: 4, fill: 'var(--color-best_e1rm)', strokeWidth: 2, stroke: 'var(--card)' }}
          activeDot={{ r: 6, fill: 'var(--color-best_e1rm)', strokeWidth: 2, stroke: 'var(--card)' }}
        />
      </LineChart>
    </ChartContainer>
  )
}
