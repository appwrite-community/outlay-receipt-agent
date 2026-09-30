import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Ban, ChevronRight, FileQuestion, RotateCw, Trash2, TriangleAlert } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { ActivityTimeline } from '@/components/app/ActivityTimeline'
import { AgentAvatar } from '@/components/app/Avatar'
import { DeleteExpenseDialog } from '@/components/app/DeleteExpenseDialog'
import { EmptyState } from '@/components/app/EmptyState'
import { ExpenseForm } from '@/components/app/ExpenseForm'
import { FieldGrid } from '@/components/app/ExpenseFields'
import { FlagCard } from '@/components/app/FlagCard'
import { LineItemsSkeleton, LineItemsTable } from '@/components/app/LineItemsTable'
import { PageHeader } from '@/components/app/PageHeader'
import { ReceiptViewer } from '@/components/app/ReceiptViewer'
import { StatusChip } from '@/components/app/StatusChip'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { canRetry, isStuck, merchantHistory } from '@/lib/agent'
import { categoryLabel } from '@/lib/categories'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { retryExpense } from '@/lib/queries/changes'
import { activityQuery, expenseQuery, flagsQuery, lineItemsQuery } from '@/lib/queries/expenses'
import { errorMessage } from '@/lib/query-client'
import { usePageTitle } from '@/lib/use-page-title'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/expenses/$expenseId')({
  loader: ({ context: { queryClient }, params: { expenseId } }) =>
    Promise.all([
      queryClient.ensureQueryData(expenseQuery(expenseId)),
      queryClient.ensureQueryData(lineItemsQuery(expenseId)),
      queryClient.ensureQueryData(flagsQuery(expenseId)),
      queryClient.ensureQueryData(activityQuery(expenseId)),
    ]),
  component: ExpenseDetail,
})

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="border-t border-border px-6 py-5">
      <header className="mb-3.5 flex h-6 items-center justify-between gap-3">
        <h2 className="eyebrow text-fg-3">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

function Callout({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: 'crit' | 'accent'
  icon?: typeof Ban
  title: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3.5',
        tone === 'crit'
          ? 'border-crit-line bg-[rgb(242_109_109/0.05)]'
          : 'border-accent-line bg-[rgb(143_132_255/0.05)]',
      )}
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-fg">
        {Icon ? <Icon className="size-4 text-crit" /> : <AgentAvatar />}
        {title}
      </p>
      <div className="mt-1.5 text-sm text-fg-2">{children}</div>
    </div>
  )
}

function FieldGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index} className={cn('flex flex-col gap-1.5', index === 0 && 'col-span-2')}>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
      ))}
    </div>
  )
}

function NotFoundState({ deleted }: { deleted: boolean }) {
  return (
    <div className="grid flex-1 place-items-center">
      <EmptyState
        icon={deleted ? Trash2 : FileQuestion}
        title={deleted ? 'This expense was deleted' : 'Expense not found'}
        description={
          deleted
            ? 'It was deleted in another tab or window.'
            : 'It was deleted, or it belongs to a different account.'
        }
      >
        <Button asChild variant="primary">
          <Link to="/expenses">Go to expenses</Link>
        </Button>
      </EmptyState>
    </div>
  )
}

function ExpenseDetail() {
  const { expenseId } = Route.useParams()
  const navigate = useNavigate()
  const { data: expense } = useQuery(expenseQuery(expenseId))
  const { data: items } = useQuery(lineItemsQuery(expenseId))
  const { data: flags = [] } = useQuery(flagsQuery(expenseId))
  const { data: steps = [] } = useQuery(activityQuery(expenseId))
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [retriedAt, setRetriedAt] = useState<string | null>(null)
  const seen = useRef(false)
  if (expense) seen.current = true

  usePageTitle(expense ? (expense.merchant ?? expense.fileName) : 'Expense')

  // Leave edit mode when the agent takes the expense back, for example after a retry.
  useEffect(() => {
    if (expense && expense.status !== 'ready' && expense.status !== 'needs_review')
      setEditing(false)
  }, [expense])

  if (!expense) {
    return (
      <>
        <PageHeader title={<Breadcrumb name={null} />} />
        <NotFoundState deleted={seen.current} />
      </>
    )
  }

  const openFlags = flags.filter((flag) => flag.status !== 'resolved')
  const processing = expense.status === 'processing'
  const filed = expense.status === 'ready' || expense.status === 'needs_review'
  const stuck = isStuck(expense)
  const retrying = retriedAt === expense.$updatedAt

  async function handleRetry() {
    if (!expense) return
    setRetriedAt(expense.$updatedAt)
    try {
      await retryExpense(expense)
      toast.success('The agent is reading the receipt again')
    } catch (error) {
      setRetriedAt(null)
      toast.error(errorMessage(error, 'Could not start the agent. Try again.'))
    }
  }

  const retryButton = canRetry(expense) && (
    <Button
      size="sm"
      variant={expense.status === 'failed' || stuck ? 'primary' : 'secondary'}
      onClick={handleRetry}
      disabled={retrying}
    >
      <RotateCw />
      Retry
    </Button>
  )

  return (
    <>
      <PageHeader
        title={<Breadcrumb name={expense.merchant ?? expense.fileName} mono={!expense.merchant} />}
      />
      <div className="flex min-h-0 flex-1 flex-col md:h-[calc(100dvh-56px)] md:flex-none md:flex-row">
        <ReceiptViewer
          expense={expense}
          className="h-[62dvh] shrink-0 border-b border-border md:h-auto md:w-[55%] md:border-r md:border-b-0"
        />

        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-4 px-6 pt-5 pb-5">
            <div className="flex items-center gap-2">
              <StatusChip
                status={expense.status}
                label={processing ? 'Agent is reading' : undefined}
              />
              {expense.status === 'needs_review' && (
                <span className="text-xs text-fg-2">
                  {openFlags.length} {openFlags.length === 1 ? 'field' : 'fields'} to check
                </span>
              )}
              <div className="ml-auto flex items-center gap-1.5">
                {retryButton}
                <Tooltip
                  content={
                    filed
                      ? null
                      : processing
                        ? 'The agent is still reading this receipt'
                        : 'Retry first, so the agent can read the receipt'
                  }
                >
                  <span>
                    <Button size="sm" onClick={() => setEditing(true)} disabled={!filed || editing}>
                      Update
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip
                  content={processing && !stuck ? 'Wait until the agent finishes' : 'Delete'}
                >
                  <span>
                    <Button
                      size="icon-sm"
                      onClick={() => setConfirmDelete(true)}
                      disabled={processing && !stuck}
                      aria-label="Delete"
                    >
                      <Trash2 />
                    </Button>
                  </span>
                </Tooltip>
              </div>
            </div>

            <div>
              <h2
                className={cn(
                  'truncate text-lg font-semibold text-fg',
                  !expense.merchant && 'font-mono text-md',
                )}
              >
                {expense.merchant ?? expense.fileName}
              </h2>
              {processing ? (
                <div className="mt-2 flex flex-col gap-2">
                  <Skeleton className="h-9 w-40" />
                  <Skeleton className="h-3.5 w-48" />
                </div>
              ) : (
                filed && (
                  <>
                    <p className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-fg tabular">
                      {expense.totalMinor !== null && expense.currency
                        ? formatMoney(expense.totalMinor, expense.currency)
                        : '-'}
                    </p>
                    <p className="mt-1 text-sm text-fg-2 tabular">
                      {[
                        expense.spentOn && formatDate(expense.spentOn),
                        expense.category && categoryLabel(expense.category),
                        expense.paymentMethod,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </>
                )
              )}
            </div>

            {filed && expense.agentSummary && (
              <p className="flex gap-2.5 text-sm text-fg-2">
                <AgentAvatar className="mt-0.5" />
                <span>{expense.agentSummary}</span>
              </p>
            )}

            {processing && (
              <Callout
                tone="accent"
                title={stuck ? 'The agent stopped answering' : 'The agent is reading this receipt'}
              >
                {stuck ? (
                  <p>The last step was more than 4 minutes ago. Retry to start over.</p>
                ) : (
                  <div className="mt-2">
                    {steps.length > 0 ? (
                      <ActivityTimeline steps={steps} working />
                    ) : (
                      <p>Waiting for the agent to start.</p>
                    )}
                  </div>
                )}
              </Callout>
            )}
            {expense.status === 'failed' && (
              <Callout tone="crit" icon={TriangleAlert} title="Could not file this receipt">
                {expense.failureReason ??
                  'Something went wrong while filing this receipt. Retry to try again.'}
              </Callout>
            )}
            {expense.status === 'rejected' && (
              <Callout tone="crit" icon={Ban} title="Not a receipt">
                <p>
                  {expense.failureReason ??
                    'The agent could not find a receipt or an invoice in this file.'}
                </p>
                <p className="mt-1">If it is a receipt, retry it. If not, delete this upload.</p>
              </Callout>
            )}

            {openFlags.length > 0 && !editing && (
              <div className="flex flex-col gap-2.5">
                <h2 className="eyebrow mt-1 text-fg-3">Needs your review</h2>
                {openFlags.map((flag) => (
                  <FlagCard key={flag.$id} expense={expense} flag={flag} openFlags={openFlags} />
                ))}
              </div>
            )}
          </div>

          {(filed || processing) && (
            <Section title="Details">
              {processing ? (
                <FieldGridSkeleton />
              ) : editing ? (
                <ExpenseForm
                  expense={expense}
                  openFlags={openFlags}
                  onDone={() => setEditing(false)}
                />
              ) : (
                <FieldGrid expense={expense} history={merchantHistory(steps)} />
              )}
            </Section>
          )}

          {!editing && expense.note && (
            <Section title="Note">
              <p className="text-sm whitespace-pre-line text-fg">{expense.note}</p>
            </Section>
          )}

          {(filed || processing) && (
            <Section title="Line items">
              {processing || !items ? (
                <LineItemsSkeleton />
              ) : (
                <LineItemsTable expense={expense} items={items} />
              )}
            </Section>
          )}

          {!processing && steps.length > 0 && (
            <Section title="Activity">
              <ActivityTimeline steps={steps} working={false} />
            </Section>
          )}
        </div>
      </div>

      <DeleteExpenseDialog
        expense={expense}
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        onDeleted={() => navigate({ to: '/expenses' })}
      />
    </>
  )
}

function Breadcrumb({ name, mono }: { name: string | null; mono?: boolean }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
      <Link
        to="/expenses"
        className="shrink-0 rounded-sm text-fg-2 transition-colors hover:text-fg"
      >
        Expenses
      </Link>
      {name && (
        <>
          <ChevronRight className="size-4 shrink-0 text-fg-3" />
          <span className={cn('truncate', mono && 'font-mono text-sm')}>{name}</span>
        </>
      )}
    </nav>
  )
}
