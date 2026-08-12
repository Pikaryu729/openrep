import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

/**
 * The three states every widget owes its reader, in one place.
 *
 * The house rule (see routes/workouts.$workoutId.tsx) is never `?? []`: an
 * empty array is indistinguishable from a pending or failed fetch, so a
 * network blip would render as "you have no data" — which reads as data loss.
 */
export function WidgetState({
  error,
  loading,
  empty,
  emptyMessage,
  children,
}: {
  error: Error | null
  loading: boolean
  empty: boolean
  emptyMessage: ReactNode
  children: ReactNode
}) {
  if (error) {
    return <p className="text-destructive text-sm">Could not load: {error.message}</p>
  }
  if (loading) {
    return <Skeleton className="h-24 w-full" />
  }
  if (empty) {
    return typeof emptyMessage === 'string' ? (
      <p className="text-muted-foreground text-sm">{emptyMessage}</p>
    ) : (
      <>{emptyMessage}</>
    )
  }
  return <>{children}</>
}
