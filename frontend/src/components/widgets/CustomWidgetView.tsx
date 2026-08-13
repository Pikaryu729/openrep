import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { StatTile } from '@/components/StatTile'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { CustomWidget, QueryResult } from '@/lib/api'
import { type UnitSystem, useUnits } from '@/lib/units'
import {
  chronological,
  formatGroup,
  formatGroupLong,
  formatMetric,
  formatStatValue,
  toChartRows,
  toDisplayValue,
  unitSuffix,
} from '@/lib/widgetQuery'

/**
 * One user-authored query, drawn four ways.
 *
 * The result is self-describing — every column arrives with a label and a unit
 * — so this renders any query the editor can build without knowing what it
 * asked for. That is the whole point of the query being data rather than code.
 */

/**
 * Series colors, assigned by slot order and never cycled (see the note on
 * --chart-N in index.css).
 *
 * A lone metric wears the brand accent, like every other chart in the app —
 * there is no identity to confuse when there is only one mark. From two
 * metrics up, the fixed validated ramp takes over, because --accent is a hue
 * the user chose and nothing guarantees it separates from its neighbours.
 */
const SERIES_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)']

function seriesColor(index: number, total: number): string {
  return total === 1 ? 'var(--accent)' : SERIES_COLORS[index]
}

function chartConfig(result: QueryResult, units: UnitSystem): ChartConfig {
  const config: ChartConfig = {}
  const metrics = metricColumns(result)
  metrics.forEach((column, index) => {
    const suffix = unitSuffix(column.unit, units)
    config[column.key] = {
      label: suffix ? `${column.label} (${suffix})` : column.label,
      color: seriesColor(index, metrics.length),
    }
  })
  return config
}

function metricColumns(result: QueryResult) {
  return result.columns.filter((column) => column.kind === 'metric')
}

function Chart({
  result,
  units,
  kind,
}: {
  result: QueryResult
  units: UnitSystem
  kind: 'bar' | 'line'
}) {
  const metrics = metricColumns(result)
  const config = chartConfig(result, units)
  const rows = toChartRows(
    chronological(result.rows, result.group_by),
    result.columns,
    result.group_by,
    units,
  )

  const axes = (
    <>
      {/* Recessive grid: horizontal only — vertical rules compete with the marks. */}
      <CartesianGrid vertical={false} stroke="var(--border)" />
      <XAxis dataKey="group" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} />
      <YAxis tickLine={false} axisLine={false} tickMargin={8} width={52} />
      <ChartTooltip
        cursor={kind === 'bar' ? { fill: 'var(--muted)' } : true}
        content={
          <ChartTooltipContent
            labelFormatter={(_label, payload) =>
              formatGroupLong(
                (payload?.[0]?.payload?.groupRaw as string | null) ?? null,
                result.group_by,
              )
            }
          />
        }
      />
      {metrics.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
    </>
  )

  if (kind === 'line') {
    return (
      <ChartContainer className="h-64 w-full" config={config}>
        <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          {axes}
          {metrics.map((metric) => (
            <Line
              key={metric.key}
              type="monotone"
              dataKey={metric.key}
              stroke={`var(--color-${metric.key})`}
              strokeWidth={2}
              // Gaps are real: a group with no data is not a zero, so the line
              // must not dive to the axis and back.
              connectNulls={false}
              dot={rows.length <= 30}
              activeDot={{ r: 4 }}
            />
          ))}
        </LineChart>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer className="h-64 w-full" config={config}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        {axes}
        {metrics.map((metric) => (
          <Bar
            key={metric.key}
            dataKey={metric.key}
            fill={`var(--color-${metric.key})`}
            radius={[4, 4, 0, 0]}
            maxBarSize={24}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}

function ResultTable({ result, units }: { result: QueryResult; units: UnitSystem }) {
  const [group, ...metrics] = result.columns

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {result.group_by !== 'none' && <TableHead>{group.label}</TableHead>}
            {metrics.map((column) => {
              const suffix = unitSuffix(column.unit, units)
              return (
                <TableHead key={column.key} className="text-right">
                  {column.label}
                  {suffix && <span className="ml-1 font-normal text-xs">({suffix})</span>}
                </TableHead>
              )
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.rows.map((row) => (
            <TableRow key={row.group ?? 'total'}>
              {result.group_by !== 'none' && (
                <TableCell className="font-medium">
                  {formatGroup(row.group, result.group_by)}
                </TableCell>
              )}
              {metrics.map((column) => {
                const raw = row[column.key]
                return (
                  <TableCell key={column.key} className="text-right tabular-nums">
                    {formatMetric(
                      toDisplayValue(typeof raw === 'number' ? raw : null, column.unit, units),
                    )}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

/**
 * The "big number" view.
 *
 * Grouped queries still make sense here — the first row after sorting is the
 * headline ("your best week"), which is exactly what a sort-by-metric query is
 * asking for — so the group gets named underneath rather than being dropped.
 */
function StatView({ result, units }: { result: QueryResult; units: UnitSystem }) {
  const row = result.rows[0]
  const metrics = metricColumns(result)

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((column) => {
        const raw = row?.[column.key]
        const { display, exact } = formatStatValue(
          toDisplayValue(typeof raw === 'number' ? raw : null, column.unit, units),
        )
        return (
          <StatTile
            key={column.key}
            label={column.label}
            value={display}
            unit={unitSuffix(column.unit, units)}
            // Only set once compacting actually dropped digits, so the exact
            // figure is still on screen rather than rounded away.
            hint={exact}
          />
        )
      })}
      {result.group_by !== 'none' && row && (
        <p className="self-end text-muted-foreground text-xs sm:col-span-2 lg:col-span-4">
          {formatGroupLong(row.group, result.group_by)}
          {result.rows.length > 1 && ` · top of ${result.rows.length} ${result.group_by} groups`}
        </p>
      )}
    </div>
  )
}

export function CustomWidgetResult({
  widget,
  result,
}: {
  widget: Pick<CustomWidget, 'visualization'>
  result: QueryResult
}) {
  const units = useUnits()

  return (
    <>
      {widget.visualization === 'table' && <ResultTable result={result} units={units} />}
      {widget.visualization === 'stat' && <StatView result={result} units={units} />}
      {(widget.visualization === 'bar' || widget.visualization === 'line') && (
        <Chart result={result} units={units} kind={widget.visualization} />
      )}
      {result.truncated && (
        <p className="mt-2 text-muted-foreground text-xs">
          Showing the first {result.rows.length} groups — add a limit to this widget to choose which
          ones.
        </p>
      )}
    </>
  )
}
