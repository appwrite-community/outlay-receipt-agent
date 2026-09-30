import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowUpRight, ChevronDown, ChevronUp, CircleCheck } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { AgentAvatar } from '@/components/app/Avatar'
import { EmptyState } from '@/components/app/EmptyState'
import { FieldRow } from '@/components/app/ExpenseFields'
import { FlagCard } from '@/components/app/FlagCard'
import { LineItemsTable } from '@/components/app/LineItemsTable'
import { PageHeader } from '@/components/app/PageHeader'
import { ReceiptViewer } from '@/components/app/ReceiptViewer'
import { ReviewQueue } from '@/components/app/ReviewQueue'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip } from '@/components/ui/tooltip'
import { merchantHistory } from '@/lib/agent'
import { EDITABLE_FIELDS, FIELD_LABELS } from '@/lib/fields'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import {
  activityQuery,
  expenseQuery,
  flagsQuery,
  lineItemsQuery,
  reviewQueueQuery,
} from '@/lib/queries/expenses'
import type { Expense } from '@/lib/types'
import { usePageTitle } from '@/lib/use-page-title'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/review/$expenseId')({
  loader: ({ context: { queryClient }, params: { expenseId } }) =>
    Promise.all([
      queryClient.ensureQueryData(reviewQueueQuery),
      queryClient.ensureQueryData(expenseQuery(expenseId)),
      queryClient.ensureQueryData(flagsQuery(expenseId)),
      queryClient.ensureQueryData(lineItemsQuery(expenseId)),
      queryClient.ensureQueryData(activityQuery(expenseId)),
    ]),
  component: Review,
})

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))

function Review() {
  const { expenseId } = Route.useParams()
  return <ReviewWorkspace key={expenseId} expenseId={expenseId} />
}

/**
 * The receipt next to what the agent read. Flagged fields come first; when the
 * last one is resolved the expense is filed and the next one in the queue opens.
 */
function ReviewWorkspace({ expenseId }: { expenseId: string }) {
  const navigate = useNavigate()
  const { data: queue = [] } = useQuery(reviewQueueQuery)
  const { data: expense } = useQuery(expenseQuery(expenseId))
  const { data: flags = [] } = useQuery(flagsQuery(expenseId))
  const { data: items = [] } = useQuery(lineItemsQuery(expenseId))
  const { data: steps = [] } = useQuery(activityQuery(expenseId))
  usePageTitle(expense ? `Review ${expense.merchant ?? expense.fileName}` : 'Review')

  // The queue as it was when this expense opened, so "next" stays stable while it changes.
  const queueRef = useRef(queue)
  if (queue.some((item) => item.$id === expenseId)) queueRef.current = queue
  const index = queueRef.current.findIndex((item) => item.$id === expenseId)

  const go = useCallback(
    (target: Expense | undefined) => {
      if (target)
        void navigate({
          to: '/review/$expenseId',
          params: { expenseId: target.$id },
          replace: true,
        })
      else void navigate({ to: '/review', replace: true })
    },
    [navigate],
  )

  const advanced = useRef(false)
  const advance = useCallback(() => {
    if (advanced.current) return
    advanced.current = true
    const rest = queueRef.current.filter((item) => item.$id !== expenseId)
    go(rest[Math.min(Math.max(index, 0), rest.length - 1)])
  }, [expenseId, index, go])

  // Resolved here, in another tab, or deleted: move on.
  const status = expense?.status
  const wasInReview = useRef(false)
  useEffect(() => {
    if (status === 'needs_review') wasInReview.current = true
    else if (wasInReview.current) advance()
  }, [status, advance])

  // J and K move through the queue.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      if (document.querySelector('[role="dialog"], [role="listbox"], [role="menu"]')) return
      const step = event.key === 'j' ? 1 : event.key === 'k' ? -1 : 0
      const target = queue[queue.findIndex((item) => item.$id === expenseId) + step]
      if (!step || !target) return
      event.preventDefault()
      go(target)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [queue, expenseId, go])

  const position = queue.findIndex((item) => item.$id === expenseId)
  const openFlags = flags.filter((flag) => flag.status !== 'resolved')
  const flaggedFields = new Set<string>(openFlags.map((flag) => flag.field))
  const history = merchantHistory(steps)

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2.5">
            Review
            {queue.length > 0 && (
              <span className="rounded-full border border-warn-line bg-warn-tint px-2 text-2xs font-semibold text-warn tabular">
                {queue.length}
              </span>
            )}
          </span>
        }
      >
        {position >= 0 && (
          <div className="flex items-center gap-1">
            <span className="mr-1.5 text-xs text-fg-2 tabular">
              {position + 1} of {queue.length}
            </span>
            <Tooltip
              content={
                <>
                  Previous <Kbd className="ml-1">K</Kbd>
                </>
              }
            >
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={position <= 0}
                onClick={() => go(queue[position - 1])}
                aria-label="Previous"
              >
                <ChevronUp />
              </Button>
            </Tooltip>
            <Tooltip
              content={
                <>
                  Next <Kbd className="ml-1">J</Kbd>
                </>
              }
            >
              <Button
                size="icon-sm"
                variant="ghost"
                disabled={position >= queue.length - 1}
                onClick={() => go(queue[position + 1])}
                aria-label="Next"
              >
                <ChevronDown />
              </Button>
            </Tooltip>
          </div>
        )}
      </PageHeader>

      {!expense ? (
        <div className="grid flex-1 place-items-center">
          <EmptyState
            icon={CircleCheck}
            title="This expense is no longer in review"
            description="It was filed or deleted."
          >
            <Button asChild variant="primary">
              <Link to="/review">Open the queue</Link>
            </Button>
          </EmptyState>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 md:h-[calc(100dvh-56px)] md:flex-none md:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[240px_minmax(0,1fr)_400px]">
          <div className="hidden min-h-0 border-r border-border bg-surface-1 xl:flex xl:flex-col">
            <ReviewQueue queue={queue} currentId={expenseId} />
          </div>

          <ReceiptViewer
            expense={expense}
            className="h-[55dvh] border-b border-border md:h-auto md:border-b-0"
          />

          <aside
            aria-label="What the agent read"
            className="flex min-h-0 flex-col border-l border-border bg-surface-1"
          >
            <div className="min-h-0 flex-1 overflow-y-auto">
              <header className="px-5 pt-5 pb-4">
                <div className="flex items-start gap-3">
                  <h2
                    className={cn(
                      'min-w-0 flex-1 truncate text-lg font-semibold text-fg',
                      !expense.merchant && 'font-mono text-md',
                    )}
                  >
                    {expense.merchant ?? expense.fileName}
                  </h2>
                  <Tooltip content="Open the expense">
                    <Button asChild size="icon-sm" variant="ghost" className="-mr-1.5">
                      <Link
                        to="/expenses/$expenseId"
                        params={{ expenseId }}
                        aria-label="Open the expense"
                      >
                        <ArrowUpRight />
                      </Link>
                    </Button>
                  </Tooltip>
                </div>
                <p className="mt-0.5 text-sm text-fg-2 tabular">
                  {[
                    expense.totalMinor !== null &&
                      expense.currency &&
                      formatMoney(expense.totalMinor, expense.currency),
                    expense.spentOn && formatDate(expense.spentOn),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {expense.agentSummary && (
                  <p className="mt-3 flex gap-2.5 text-xs text-fg-2">
                    <AgentAvatar className="mt-px size-4" />
                    <span>{expense.agentSummary}</span>
                  </p>
                )}
              </header>

              {openFlags.length > 0 ? (
                <section className="flex flex-col gap-2.5 px-5 pb-5">
                  <h2 className="eyebrow text-fg-3">Needs your review · {openFlags.length}</h2>
                  {openFlags.map((flag, flagIndex) => (
                    <FlagCard
                      key={flag.$id}
                      expense={expense}
                      flag={flag}
                      openFlags={openFlags}
                      focused={flagIndex === 0}
                      onResolved={(done) => done && advance()}
                    />
                  ))}
                </section>
              ) : (
                <div className="mx-5 mb-5 flex items-center gap-2 rounded-lg border border-good-line bg-good-tint px-3.5 py-3 text-sm text-fg">
                  <CircleCheck className="size-4 text-good" />
                  Nothing left to check on this expense.
                </div>
              )}

              <section className="border-t border-border px-2 py-3">
                <h2 className="eyebrow px-3 pt-1 pb-2 text-fg-3">Details</h2>
                {EDITABLE_FIELDS.filter((field) => !flaggedFields.has(field)).map((field) => (
                  <FieldRow
                    key={field}
                    expense={expense}
                    field={field}
                    openFlags={openFlags}
                    history={history}
                  />
                ))}
              </section>

              <section className="border-t border-border px-5 py-4">
                <h2 className="eyebrow pb-3 text-fg-3">Line items</h2>
                <LineItemsTable expense={expense} items={items} />
              </section>
            </div>

            <footer className="hidden shrink-0 items-center gap-4 border-t border-border px-5 py-2.5 text-2xs text-fg-3 md:flex">
              <span className="flex items-center gap-1.5">
                <Kbd>J</Kbd>
                <Kbd>K</Kbd>
                Next, previous
              </span>
              {openFlags[0] && openFlags[0].field !== 'duplicate' && (
                <span className="flex items-center gap-1.5">
                  <Kbd>Enter</Kbd>
                  Confirm {FIELD_LABELS[openFlags[0].field].noun}
                </span>
              )}
            </footer>
          </aside>
        </div>
      )}
    </>
  )
}
