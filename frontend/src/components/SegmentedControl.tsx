import { cn } from '@/lib/utils'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  'aria-label': string
  /** Each option renders `data-testid={testidPrefix + option.value}`. */
  testidPrefix: string
}

/** The bordered button-group toggle used for mode and units pickers. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  testidPrefix,
}: SegmentedControlProps<T>) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-md border bg-card"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-testid={`${testidPrefix}${option.value}`}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors not-first:border-l',
            value === option.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
