import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { EDITABLE_FIELDS, FIELD_LABELS, type FieldValues, parseField, toDraft } from '@/lib/fields'
import { updateExpense } from '@/lib/queries/changes'
import { errorMessage } from '@/lib/query-client'
import type { Expense, ExpenseField, ReviewFlag } from '@/lib/types'
import { cn } from '@/lib/utils'
import { FieldInput } from './FieldInput'

/**
 * Edits every field of an expense at once. Only the fields you change are
 * saved, and each change is recorded in the timeline as yours.
 */
export function ExpenseForm({
  expense,
  openFlags,
  onDone,
}: {
  expense: Expense
  openFlags: ReviewFlag[]
  onDone: () => void
}) {
  const initial = toDraft(expense)
  const [draft, setDraft] = useState(initial)
  const [note, setNote] = useState(expense.note ?? '')
  const [errors, setErrors] = useState<Partial<Record<ExpenseField, string>>>({})
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const values: Partial<FieldValues> = {}
    const nextErrors: typeof errors = {}
    const currency = draft.currency.trim().toUpperCase() || expense.currency

    // Amounts are read in the currency the form ends up with.
    const currencyChanged = currency !== expense.currency
    const changed = EDITABLE_FIELDS.filter(
      (field) => draft[field] !== initial[field] || (currencyChanged && (field === 'total' || field === 'tax')),
    )
    for (const field of changed) {
      const parsed = parseField(field, draft[field], currency)
      if (parsed.error !== undefined) nextErrors[field] = parsed.error
      else Object.assign(values, { [field]: parsed.value })
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    try {
      await updateExpense({ expense, openFlags, values, note: note.trim() || null })
      toast.success('Expense updated')
      onDone()
    } catch (error) {
      toast.error(errorMessage(error, 'Could not update the expense. Try again.'))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
        {EDITABLE_FIELDS.map((field) => (
          <div key={field} className={cn('flex min-w-0 flex-col gap-1.5', field === 'merchant' && 'col-span-2')}>
            <label htmlFor={`edit-${field}`} className="text-xs font-medium text-fg-2">
              {FIELD_LABELS[field].title}
            </label>
            <FieldInput
              id={`edit-${field}`}
              field={field}
              value={draft[field]}
              onChange={(value) => setDraft((previous) => ({ ...previous, [field]: value }))}
              currency={draft.currency || expense.currency}
              invalid={Boolean(errors[field])}
              autoFocus={field === 'merchant'}
            />
            {errors[field] && <p className="text-xs text-crit">{errors[field]}</p>}
          </div>
        ))}
        <div className="col-span-2 flex flex-col gap-1.5">
          <label htmlFor="edit-note" className="text-xs font-medium text-fg-2">
            Note
          </label>
          <Textarea
            id="edit-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Who you met, what it was for"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={saving}>
          Update
        </Button>
      </div>
    </form>
  )
}
