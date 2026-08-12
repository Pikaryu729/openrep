import { cn } from '@/lib/utils'

/**
 * A single headline number. The right form for one value — a one-bar bar chart
 * is not.
 */
export function StatTile({
  label,
  value,
  unit,
  hint,
  className,
}: {
  label: string
  value: string
  unit?: string
  hint?: string | null
  className?: string
}) {
  return (
    <div className={cn('rounded-lg border bg-card p-4 shadow-xs', className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold text-2xl tracking-tight tabular-nums">
        {value}
        {unit && <span className="ml-1 font-normal text-base text-muted-foreground">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-muted-foreground text-xs">{hint}</p>}
    </div>
  )
}
