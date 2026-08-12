import { Modal } from '@/components/Modal'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  isPending?: boolean
  error?: string | null
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  isPending = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm text-muted-foreground">{message}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={danger ? 'destructive' : 'default'} onClick={onConfirm} disabled={isPending}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </Modal>
  )
}
