import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { WidgetInstance } from '@/lib/dashboard'
import { cn } from '@/lib/utils'
import { WidgetOptionsForm } from './WidgetOptionsForm'

/**
 * A widget plus its edit chrome.
 *
 * Remove deliberately does NOT go through ConfirmDialog, unlike every other
 * destructive action in this app. Nothing is destroyed until Save, and Cancel
 * is a full undo, so a confirmation here would be friction with no safety
 * value. The actions that genuinely discard work — Cancel with changes, Reset,
 * Import — all still confirm.
 */
export function WidgetFrame({
  widget,
  title,
  editing,
  canMoveUp,
  canMoveDown,
  onMove,
  onRemove,
  onChange,
  children,
}: {
  widget: WidgetInstance
  title: string
  editing: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
  onChange: (widget: WidgetInstance) => void
  children: React.ReactNode
}) {
  const [configuring, setConfiguring] = useState(false)

  const controls = editing && (
    <div className="flex flex-wrap justify-end gap-1">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Move widget up"
        disabled={!canMoveUp}
        onClick={() => onMove(-1)}
      >
        ↑
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Move widget down"
        disabled={!canMoveDown}
        onClick={() => onMove(1)}
      >
        ↓
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfiguring((open) => !open)}>
        {configuring ? 'Done' : 'Configure'}
      </Button>
      <Button variant="ghost" size="sm" onClick={onRemove}>
        Remove
      </Button>
    </div>
  )

  const optionsForm = editing && configuring && (
    <div className="mb-4 rounded-md border border-dashed p-3">
      <WidgetOptionsForm widget={widget} onChange={onChange} />
    </div>
  )

  // The stat tiles are a bare grid in view mode so the default dashboard looks
  // exactly as it did before widgets existed. In edit mode they still need a
  // handle, so they get a dashed wrapper rather than a full card.
  if (widget.type === 'stat_tiles') {
    return (
      <section className={cn(editing && 'rounded-lg border border-dashed p-3')}>
        {editing && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-medium text-muted-foreground text-sm">{title}</h2>
            {controls}
          </div>
        )}
        {optionsForm}
        {children}
      </section>
    )
  }

  return (
    <Card className={cn(editing && 'border-dashed')}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        {/* A real heading, not just styled text: a dashboard of widgets is
            exactly the case where heading navigation earns its keep. */}
        <CardTitle asChild>
          <h2>{title}</h2>
        </CardTitle>
        {controls}
      </CardHeader>
      <CardContent>
        {optionsForm}
        {children}
      </CardContent>
    </Card>
  )
}
