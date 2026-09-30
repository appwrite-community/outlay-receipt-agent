import { Link } from '@tanstack/react-router'
import { Tooltip } from '@/components/ui/tooltip'
import { formatDateTime, formatRelative } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { Expense } from '@/lib/types'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

/** "2 fields", or "Duplicate" when the only open flag is a possible duplicate. */
function flagSummary(expense: Expense): string {
  const flags = expense.openFlags ?? 0
  if (expense.duplicateOf && flags === 1) return 'Duplicate'
  return `${flags} ${flags === 1 ? 'field' : 'fields'}`
}

/** Expenses waiting for you, oldest first. */
export function ReviewQueue({ queue, currentId }: { queue: Expense[]; currentId: string }) {
  const now = useNow(30_000)
  return (
    <nav aria-label="Review queue" className="flex min-h-0 flex-col">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border px-4">
        <h2 className="eyebrow text-fg-3">Queue</h2>
        <span className="text-2xs text-fg-3 tabular">{queue.length}</span>
      </header>
      <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {queue.map((expense) => {
          const active = expense.$id === currentId
          return (
            <li key={expense.$id} className="animate-rise">
              <Link
                to="/review/$expenseId"
                params={{ expenseId: expense.$id }}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-col gap-1 rounded-md px-3 py-2.5 transition-colors hover:bg-surface-2',
                  active && 'bg-surface-2 before:absolute before:inset-y-2.5 before:left-0 before:w-0.5 before:rounded-full before:bg-warn',
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn('min-w-0 flex-1 truncate text-sm', expense.merchant ? 'font-medium text-fg' : 'font-mono text-xs text-fg-2')}>
                    {expense.merchant ?? expense.fileName}
                  </span>
                  <span className="shrink-0 text-sm text-fg tabular">
                    {expense.totalMinor !== null && expense.currency ? formatMoney(expense.totalMinor, expense.currency) : ''}
                  </span>
                </span>
                <span className="flex items-center gap-2 text-xs text-fg-3">
                  <span className="rounded-sm border border-warn-line bg-warn-tint px-1.5 text-2xs font-medium text-warn tabular">
                    {flagSummary(expense)}
                  </span>
                  <Tooltip content={`Uploaded ${formatDateTime(expense.$createdAt)}`}>
                    <time dateTime={expense.$createdAt} className="truncate tabular">
                      {formatRelative(expense.$createdAt, now)}
                    </time>
                  </Tooltip>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
