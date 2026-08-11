import type { ReactNode } from 'react'

interface EmptyStateProps {
  title: string
  hint?: string
  action?: ReactNode
}

export function EmptyState({ title, hint, action }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-10 text-center text-muted-foreground">
      <strong className="mb-1 block font-semibold text-foreground">{title}</strong>
      {hint && <p className="text-sm">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}
