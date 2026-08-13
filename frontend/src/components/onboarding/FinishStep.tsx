import { Button } from '@/components/ui/button'
import type { SeedSummary } from './OnboardingWizard'

interface FinishStepProps {
  summary: SeedSummary | null
  onLogWorkout: () => void
  onExplore: () => void
}

function summaryLine(summary: SeedSummary | null): string {
  if (!summary) return 'Your exercise library is empty — add exercises as you go.'
  const parts: string[] = []
  if (summary.created > 0) parts.push(`Added ${summary.created} exercises to your library`)
  if (summary.existed > 0) parts.push(`${summary.existed} already existed`)
  if (parts.length === 0) return 'Your exercise library is ready.'
  return `${parts.join('; ')}.`
}

export function FinishStep({ summary, onLogWorkout, onExplore }: FinishStepProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <h2 className="text-xl font-semibold tracking-tight">You&apos;re all set</h2>
      <p className="max-w-md text-sm text-muted-foreground">{summaryLine(summary)}</p>
      {summary && summary.failed.length > 0 && (
        <p className="max-w-md text-sm text-destructive">
          Couldn&apos;t add: {summary.failed.join(', ')}. You can create them later from the
          Exercises page.
        </p>
      )}
      <p className="max-w-md text-sm text-muted-foreground">
        Log a workout and your dashboard starts charting volume and personal records.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onLogWorkout}>Log your first workout</Button>
        <Button variant="outline" onClick={onExplore}>
          Explore the dashboard
        </Button>
      </div>
    </div>
  )
}
