import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/**
 * A native <select> styled to match the shadcn Input.
 *
 * The documented deliberate exception to shadcn-first: Radix Select does not
 * drive well from Playwright's selectOption or plain fireEvent in jsdom, which
 * is how every picker in this app is tested. Extracted from
 * routes/workouts.$workoutId.tsx so the widget option forms share it.
 */
export function NativeSelect({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'h-9 w-fit min-w-40 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30',
        className,
      )}
      {...props}
    />
  )
}
