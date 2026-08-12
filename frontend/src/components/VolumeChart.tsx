import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { VolumeByDay } from '@/lib/api'
import { kgToDisplay, type UnitSystem, weightUnit } from '@/lib/units'
import { shortDate } from '@/lib/format'

/**
 * Daily training volume.
 *
 * Bars, not a line: training days are irregular, and a line between two
 * sessions a week apart draws a slope through days that never happened.
 * One series, so no legend box — the card title already names it.
 */
export function VolumeChart({ data, units }: { data: VolumeByDay[]; units: UnitSystem }) {
  const points = data.map((day) => ({
    performed_on: day.performed_on,
    volume: kgToDisplay(day.total_volume_kg, units),
    sets: day.total_sets,
  }))

  return (
    <ChartContainer
      className="h-64 w-full"
      config={{
        volume: { label: `Volume (${weightUnit(units)})`, color: 'var(--accent)' },
      }}
    >
      <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        {/* Recessive grid: horizontal only — vertical rules compete with the bars. */}
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="performed_on"
          tickFormatter={shortDate}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={16}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={48}
          tickFormatter={(value: number) => String(value)}
        />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)' }}
          content={
            <ChartTooltipContent
              labelFormatter={(label) => shortDate(String(label))}
              formatter={(value, _name, item) => (
                <span className="flex w-full justify-between gap-3">
                  <span className="text-muted-foreground">
                    {item?.payload?.sets} sets · volume ({weightUnit(units)})
                  </span>
                  <span className="font-medium tabular-nums">{String(value)}</span>
                </span>
              )}
            />
          }
        />
        {/* 4px rounded data-end, square at the baseline; capped so the band keeps its air. */}
        <Bar dataKey="volume" fill="var(--color-volume)" radius={[4, 4, 0, 0]} maxBarSize={24} />
      </BarChart>
    </ChartContainer>
  )
}
