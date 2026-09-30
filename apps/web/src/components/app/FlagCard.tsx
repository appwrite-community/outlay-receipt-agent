import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CircleAlert, Copy, FileText } from 'lucide-react'
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { FIELD_LABELS, displayValue, fieldValue, parseField, toDraft } from '@/lib/fields'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { resolveFlag } from '@/lib/queries/changes'
import { expenseQuery } from '@/lib/queries/expenses'
import { errorMessage } from '@/lib/query-client'
import type { Expense, ExpenseField, FlagResolution, ReviewFlag } from '@/lib/types'
import { cn } from '@/lib/utils'
import { AgentAvatar } from './Avatar'
import { DeleteExpenseDialog } from './DeleteExpenseDialog'
import { FieldInput } from './FieldInput'
import { receiptUrl } from './ReceiptViewer'

type FlagProps = {
  expense: Expense
  flag: ReviewFlag
  openFlags: ReviewFlag[]
  /** The flag that Enter confirms on the review screen. */
  focused?: boolean
  /** `done` is true when nothing is left to review on this expense. */
  onResolved?: (done: boolean) => void
}

function SourceTag({ flag }: { flag: ReviewFlag }) {
  return flag.source === 'model' ? (
    <span className="inline-flex items-center gap-1.5 text-2xs text-fg-2">
      <AgentAvatar className="size-4" />
      The agent was unsure
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-2xs text-fg-2">
      <CircleAlert className="size-3.5 text-warn" />A check failed
    </span>
  )
}

function FlagFrame({
  flag,
  focused,
  children,
}: {
  flag: ReviewFlag
  focused?: boolean
  children: ReactNode
}) {
  return (
    <section
      aria-label={`Review ${FIELD_LABELS[flag.field].noun}`}
      className={cn(
        'animate-rise rounded-lg border border-warn-line bg-[rgb(242_181_68/0.05)] p-3.5 transition-shadow',
        focused && 'shadow-[0_0_0_1px_rgb(242_181_68/0.45)]',
      )}
    >
      <header className="flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-warn" aria-hidden />
        <h3 className="flex-1 text-sm font-semibold text-fg">{FIELD_LABELS[flag.field].title}</h3>
        <SourceTag flag={flag} />
      </header>
      {children}
    </section>
  )
}

/** Resolves a flag and tells the person when the expense is filed. */
async function resolve(
  props: FlagProps,
  resolution: FlagResolution,
  value?: Parameters<typeof resolveFlag>[0]['value'],
) {
  const { expense, flag, openFlags, onResolved } = props
  await resolveFlag({ expense, flag, openFlags, resolution, value })
  const done = openFlags.filter((open) => open.$id !== flag.$id).length === 0
  if (done) toast.success(`${expense.merchant ?? expense.fileName} is filed`)
  onResolved?.(done)
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName))

export function FlagCard(props: FlagProps) {
  return props.flag.field === 'duplicate' ? (
    <DuplicateCard {...props} />
  ) : (
    <FieldFlagCard {...props} />
  )
}

/**
 * One field the agent could not vouch for. Confirm keeps the agent's value;
 * typing a different value and saving corrects it.
 */
function FieldFlagCard(props: FlagProps) {
  const { expense, flag, focused } = props
  const field: ExpenseField | null =
    flag.field === 'lineItems' || flag.field === 'duplicate' ? null : flag.field
  const current = field ? fieldValue(expense, field) : null
  const [text, setText] = useState(() => (field ? toDraft(expense)[field] : ''))
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const changed = field !== null && text.trim() !== toDraft(expense)[field]
  const canConfirm = field === null || (current !== null && current !== '')

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
    } catch (caught) {
      toast.error(errorMessage(caught, 'Could not save your review. Try again.'))
      setBusy(false)
    }
  }

  function save(event?: FormEvent) {
    event?.preventDefault()
    if (!field) return
    if (!changed) {
      if (canConfirm) void run(() => resolve(props, 'confirmed'))
      return
    }
    const parsed = parseField(field, text, expense.currency)
    if (parsed.error !== undefined) {
      setError(parsed.error)
      return
    }
    setError(null)
    void run(() => resolve(props, 'corrected', parsed.value))
  }

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape' && field) setText(toDraft(expense)[field])
  }

  // On the review screen, Enter confirms the focused flag.
  const confirmRef = useRef<() => void>(() => {})
  confirmRef.current = () => {
    if (busy || changed || !canConfirm) return
    void run(() => resolve(props, 'confirmed'))
  }
  useEffect(() => {
    if (!focused) return
    function onEnter(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
        return
      if (
        isTyping(event.target) ||
        document.querySelector('[role="dialog"], [role="listbox"], [role="menu"]')
      )
        return
      event.preventDefault()
      confirmRef.current()
    }
    window.addEventListener('keydown', onEnter)
    return () => window.removeEventListener('keydown', onEnter)
  }, [focused])

  return (
    <FlagFrame flag={flag} focused={focused}>
      {field && (
        <p
          className={cn(
            'mt-2.5 text-md font-semibold text-fg',
            ['total', 'tax', 'spentOn'].includes(field) && 'tabular',
          )}
        >
          {current === null || current === '' ? (
            <span className="text-fg-3">Not found on the receipt</span>
          ) : (
            displayValue(field, current, expense.currency)
          )}
        </p>
      )}
      <p className="mt-1 text-xs text-fg-2">{flag.reason}</p>

      {field ? (
        <form onSubmit={save} className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <FieldInput
              field={field}
              value={text}
              onChange={(value) => {
                setText(value)
                setError(null)
              }}
              currency={expense.currency}
              invalid={Boolean(error)}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1"
            />
            {changed ? (
              <Button type="submit" variant="primary" disabled={busy} className="w-[76px]">
                Save
              </Button>
            ) : (
              <Tooltip
                content={
                  canConfirm
                    ? `Keep ${displayValue(field, current, expense.currency)}`
                    : 'Enter the value to file this expense'
                }
              >
                <span>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={busy || !canConfirm}
                    className="w-[76px]"
                  >
                    Confirm
                  </Button>
                </span>
              </Tooltip>
            )}
          </div>
          {error && <p className="text-xs text-crit">{error}</p>}
        </form>
      ) : (
        <div className="mt-3 flex justify-end">
          <Button
            variant="primary"
            disabled={busy}
            onClick={() => run(() => resolve(props, 'confirmed'))}
          >
            Confirm
          </Button>
        </div>
      )}
    </FlagFrame>
  )
}

function Thumb({ expense }: { expense: Expense }) {
  const url = receiptUrl(expense)
  const isImage = expense.mimeType.startsWith('image/')
  return (
    <span className="grid h-16 w-12 shrink-0 place-items-center overflow-hidden rounded-sm border border-border bg-surface-3">
      {url && isImage ? (
        <img src={url} alt="" className="size-full object-cover object-top" />
      ) : (
        <FileText className="size-4 text-fg-3" />
      )}
    </span>
  )
}

function Comparison({ label, expense, link }: { label: string; expense: Expense; link?: boolean }) {
  const body = (
    <>
      <Thumb expense={expense} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="eyebrow text-fg-3">{label}</span>
        <span className="truncate text-sm font-medium text-fg">
          {expense.merchant ?? expense.fileName}
        </span>
        <span className="truncate text-xs text-fg-2 tabular">
          {[
            expense.spentOn && formatDate(expense.spentOn),
            expense.totalMinor !== null &&
              expense.currency &&
              formatMoney(expense.totalMinor, expense.currency),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
    </>
  )
  const className =
    'flex min-w-0 flex-1 items-center gap-3 rounded-md border border-border bg-surface-1 p-2'
  return link ? (
    <Link
      to="/expenses/$expenseId"
      params={{ expenseId: expense.$id }}
      className={cn(className, 'transition-colors hover:bg-surface-2')}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/** The same receipt may have been uploaded twice. Shows both side by side. */
function DuplicateCard(props: FlagProps) {
  const { expense, flag, focused } = props
  const related = useQuery({
    ...expenseQuery(flag.relatedExpenseId ?? ''),
    enabled: Boolean(flag.relatedExpenseId),
  })
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function keepBoth() {
    setBusy(true)
    try {
      await resolve(props, 'dismissed')
    } catch (caught) {
      toast.error(errorMessage(caught, 'Could not save your review. Try again.'))
      setBusy(false)
    }
  }

  return (
    <FlagFrame flag={flag} focused={focused}>
      <p className="mt-2 text-xs text-fg-2">{flag.reason}</p>
      <div className="mt-3 flex flex-col gap-2">
        <Comparison label="This upload" expense={expense} />
        {related.data ? (
          <Comparison label="Already filed" expense={related.data} link />
        ) : related.isPending && flag.relatedExpenseId ? (
          <Skeleton className="h-[82px] rounded-md" />
        ) : (
          <p className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5 text-xs text-fg-2">
            <Copy className="size-3.5 text-fg-3" />
            The other expense was deleted.
          </p>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button disabled={busy} onClick={() => setConfirmDelete(true)}>
          Delete this upload
        </Button>
        <Button variant="primary" disabled={busy} onClick={keepBoth}>
          Keep both
        </Button>
      </div>
      <DeleteExpenseDialog
        expense={expense}
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this upload?"
        onDeleted={() => props.onResolved?.(true)}
      />
    </FlagFrame>
  )
}
