import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ModalProps {
  title: string
  onClose: () => void
  children: ReactNode
}

/** App-standard modal: a thin wrapper over the shadcn Dialog primitives for
 * the common "conditionally rendered, controlled by the parent" case. */
export function Modal({ title, onClose, children }: ModalProps) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
