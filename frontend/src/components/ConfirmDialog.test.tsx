import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog', () => {
  it('confirms and cancels', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        title="Delete workout?"
        message="This deletes the workout and all its sets."
        confirmLabel="Delete"
        danger
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    expect(screen.getByRole('dialog', { name: 'Delete workout?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('closes on Escape and shows errors', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        title="Delete exercise?"
        message="Are you sure?"
        error="Exercise is used by existing sets"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    )

    expect(screen.getByText('Exercise is used by existing sets')).toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('disables the confirm button while pending', () => {
    render(
      <ConfirmDialog
        title="Import backup?"
        message="Merging data."
        isPending
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  })
})
