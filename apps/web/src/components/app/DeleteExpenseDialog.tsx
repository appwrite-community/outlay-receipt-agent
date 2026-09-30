import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { deleteExpense } from '@/lib/queries/changes'
import { errorMessage } from '@/lib/query-client'
import type { Expense } from '@/lib/types'

/** Asks before deleting an expense, its line items, its timeline, and the receipt file. */
export function DeleteExpenseDialog({
  expense,
  open,
  onOpenChange,
  onDeleted,
  title = 'Delete this expense?',
}: {
  expense: Expense
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
  title?: string
}) {
  const [deleting, setDeleting] = useState(false)
  const name = expense.merchant ?? expense.fileName

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteExpense(expense)
      onOpenChange(false)
      toast.success(`${name} deleted`)
      onDeleted()
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete this expense. Try again.'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Outlay deletes {name}, its line items, its activity, and the receipt file. You cannot undo this.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
