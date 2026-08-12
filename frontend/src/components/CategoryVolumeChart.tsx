import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { CategoryVolume } from '@/lib/api'
import { compact } from '@/lib/format'
import { kgToDisplay, type UnitSystem, weightUnit } from '@/lib/units'

/** The tail bucket. Always rendered last and in the muted tone, never as a rank. */
export const OTHER_CATEGORY = 'Other'

export interface CategoryRow {
  category: string
  volume: number
  sets: number
  isOther: boolean
}

/**
 * Categories are free text with no cap, so the tail is folded into one bucket
 * rather than growing the chart without limit.
 */
export function toCategoryRows(
  data: CategoryVolume[],
  units: UnitSystem,
  maxCategories: number,
): CategoryRow[] {
  // Defensive: the server already sorts, but a client-side sort keeps this
  // helper honest on its own.
  const sorted = [...data].sort((a, b) => b.total_volume_kg - a.total_volume_kg)
  const head = sorted.slice(0, maxCategories)
  const tail = sorted.slice(maxCategories)

  const rows: CategoryRow[] = head.map((entry) => ({
    category: entry.category,
    volume: kgToDisplay(entry.total_volume_kg, units),
    sets: entry.total_sets,
    isOther: false,
  }))

  if (tail.length) {
    rows.push({
      category: OTHER_CATEGORY,
      volume: kgToDisplay(
        tail.reduce((sum, entry) => sum + entry.total_volume_kg, 0),
        units,
      ),
      sets: tail.reduce((sum, entry) => sum + entry.total_sets, 0),
      isOther: true,
    })
  }

  return rows
}

/**
 * Ranked horizontal bars — the honest form for magnitude across a handful of
 * named classes. Deliberately not a pie: categories are unbounded here, and
 * slice angles are unreadable past a few close values.
 *
 * One series, so no legend box: the card title names what is plotted.
 */
export function CategoryVolumeChart({
  rows,
  units,
}: {
  rows: CategoryRow[]
  units: UnitSystem
}) {
  const unit = weightUnit(units)

  return (
    <ChartContainer
      className="w-full"
      // Grows with the data so three categories don't float in a mostly-empty card.
      style={{ height: Math.max(160, rows.length * 36 + 24) }}
      config={{ volume: { label: `Volume (${unit})`, color: 'var(--accent)' } }}
    >
      <BarChart layout="vertical" data={rows} margin={{ top: 4, right: 48, bottom: 0, left: 0 }}>
        {/* Inverted from VolumeChart: the value axis is x here, so the
            recessive value grid is the vertical rules. Horizontal rules would
            run along the bars instead of across them. */}
        <CartesianGrid horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          // Bars encode magnitude, so the zero baseline is mandatory.
          domain={[0, 'dataMax']}
          tickLine={false}
          axisLine={false}
          tickFormatter={compact}
        />
        <YAxis type="category" dataKey="category" width={110} tickLine={false} axisLine={false} />
        <ChartTooltip
          cursor={{ fill: 'var(--muted)' }}
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => (
                <span className="flex w-full justify-between gap-3">
                  <span className="text-muted-foreground">
                    {item?.payload?.sets} sets · volume ({unit})
                  </span>
                  <span className="font-medium tabular-nums">{String(value)}</span>
                </span>
              )}
            />
          }
        />
        <Bar dataKey="volume" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {rows.map((row) => (
            <Cell
              key={row.category}
              fill={row.isOther ? 'var(--muted-foreground)' : 'var(--color-volume)'}
            />
          ))}
          {/* Values ride the marks; text wears a text token, never the series color. */}
          <LabelList
            dataKey="volume"
            position="right"
            className="fill-muted-foreground text-xs"
            formatter={(value: unknown) => compact(Number(value))}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
