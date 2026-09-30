import { Pencil, ScanText, Search, Sparkles } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { categoryIcon } from '@/lib/categories'
import {
  EDITABLE_FIELDS,
  FIELD_LABELS,
  displayValue,
  fieldValue,
  parseField,
  provenance,
  toDraft,
} from '@/lib/fields'
import { updateExpense } from '@/lib/queries/changes'
import { errorMessage } from '@/lib/query-client'
import type { Expense, ExpenseField, ReviewFlag } from '@/lib/types'
import { cn } from '@/lib/utils'
import { FieldInput } from './FieldInput'

/**
 * Where a value came from. "history" is what the agent found when it looked
 * up the merchant, which explains the category it chose.
 */
export function ProvenanceHint({
  expense,
  field,
  history,
}: {
  expense: Expense
  field: ExpenseField
  history?: string | null
}) {
  const source = provenance(expense, field)
  const value = fieldValue(expense, field)
  if (source.kind !== 'changed' && (value === null || value === '')) return null
  if (source.kind === 'changed') {
    return (
      <span className="inline-flex items-center gap-1 text-2xs text-fg-2">
        <Pencil className="size-3 text-fg-3" />
        {source.label}
      </span>
    )
  }
  if (source.kind === 'inferred') {
    return (
      <Tooltip
        content={source.note ?? 'The agent was fairly sure, but the value is not printed clearly.'}
      >
        <span
          tabIndex={0}
          className="inline-flex cursor-help items-center gap-1 rounded-sm text-2xs text-accent-300"
        >
          <Sparkles className="size-3" />
          <span className="underline decoration-accent-300/40 decoration-dotted underline-offset-2">
            {source.label}
          </span>
        </span>
      </Tooltip>
    )
  }
  if (field === 'category' && history) {
    return (
      <span className="inline-flex min-w-0 items-start gap-1 text-2xs text-fg-3">
        <Search className="mt-0.5 size-3 shrink-0" />
        <span>{history}</span>
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-2xs text-fg-3">
      <ScanText className="size-3" />
      {field === 'category' ? 'Chosen by the agent' : source.label}
    </span>
  )
}

function FieldValue({ expense, field }: { expense: Expense; field: ExpenseField }) {
  const value = fieldValue(expense, field)
  const text = displayValue(field, value, expense.currency)
  if (value === null || value === '') return <span className="text-fg-3">Not on the receipt</span>
  if (field === 'category') {
    const Icon = categoryIcon(expense.category)
    return (
      <span className="inline-flex items-center gap-1.5">
        <Icon className="size-3.5 text-fg-3" />
        {text}
      </span>
    )
  }
  return (
    <span
      className={cn(
        (field === 'total' || field === 'tax' || field === 'spentOn') && 'tabular',
        field === 'currency' && 'font-mono',
      )}
    >
      {text}
    </span>
  )
}

/**
 * One field in a list, with an Update link that edits just this value.
 * Saving records the change as yours, so the agent learns from it.
 */
export function FieldRow({
  expense,
  field,
  openFlags,
  history,
}: {
  expense: Expense
  field: ExpenseField
  openFlags: ReviewFlag[]
  history?: string | null
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const inputId = `field-${field}`

  function startEditing() {
    setText(toDraft(expense)[field])
    setError(null)
    setEditing(true)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseField(field, text, expense.currency)
    if (parsed.error !== undefined) return setError(parsed.error)
    setSaving(true)
    try {
      await updateExpense({
        expense,
        openFlags,
        values: { [field]: parsed.value },
        note: expense.note,
      })
      setEditing(false)
    } catch (caught) {
      toast.error(errorMessage(caught, 'Could not save the change. Try again.'))
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-2 rounded-md bg-surface-2/60 px-3 py-2.5"
      >
        <label htmlFor={inputId} className="text-xs font-medium text-fg-2">
          {FIELD_LABELS[field].title}
        </label>
        <FieldInput
          id={inputId}
          field={field}
          value={text}
          onChange={setText}
          currency={expense.currency}
          invalid={Boolean(error)}
          autoFocus
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return
            event.stopPropagation()
            setEditing(false)
          }}
        />
        {error && <p className="text-xs text-crit">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" type="submit" disabled={saving}>
            Save
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="group flex items-start gap-3 rounded-md px-3 py-2 transition-colors hover:bg-surface-2/50">
      <span className="w-[88px] shrink-0 pt-px text-xs text-fg-2">{FIELD_LABELS[field].title}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-sm text-fg">
          <FieldValue expense={expense} field={field} />
        </span>
        <ProvenanceHint expense={expense} field={field} history={history} />
      </div>
      <Button
        variant="link"
        size="sm"
        onClick={startEditing}
        className="shrink-0 text-xs opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
        aria-label={`Update ${FIELD_LABELS[field].noun}`}
      >
        Update
      </Button>
    </div>
  )
}

/** The expense fields as a compact grid, for the expense page. */
export function FieldGrid({ expense, history }: { expense: Expense; history?: string | null }) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
      {EDITABLE_FIELDS.map((field) => (
        <div
          key={field}
          className={cn('flex min-w-0 flex-col gap-0.5', field === 'merchant' && 'col-span-2')}
        >
          <dt className="text-xs text-fg-2">{FIELD_LABELS[field].title}</dt>
          <dd className="truncate text-sm text-fg">
            <FieldValue expense={expense} field={field} />
          </dd>
          <dd className="min-w-0">
            <ProvenanceHint expense={expense} field={field} history={history} />
          </dd>
        </div>
      ))}
    </dl>
  )
}
