import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Tooltip } from '@/components/ui/tooltip'
import { formatDateTime, formatRelative } from '@/lib/format'
import { accountQuery } from '@/lib/queries/account'
import type { ActivityWithExpense } from '@/lib/queries/expenses'
import { useNow } from '@/lib/use-now'
import { StepAvatar } from './ActivityTimeline'

/** The latest steps by the agent and by you, across every expense. */
export function RecentActivity({ items }: { items: ActivityWithExpense[] }) {
  const { data: user } = useQuery(accountQuery)
  const now = useNow(30_000)

  return (
    <ul className="flex flex-col">
      {items.map(({ activity, expense }) => (
        <li key={activity.$id} className="animate-rise">
          <Link
            to="/expenses/$expenseId"
            params={{ expenseId: activity.expenseId }}
            disabled={!expense}
            className="flex gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-2"
          >
            <StepAvatar step={activity} userName={user?.name ?? 'You'} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-fg">{activity.label}</p>
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-fg-3">
                <span className="shrink-0 text-fg-2">{activity.actor === 'agent' ? 'Agent' : 'You'}</span>
                <span aria-hidden>·</span>
                <span className="truncate">{expense?.merchant ?? expense?.fileName ?? 'Deleted expense'}</span>
                <span aria-hidden>·</span>
                <Tooltip content={formatDateTime(activity.$createdAt)}>
                  <time dateTime={activity.$createdAt} className="shrink-0 tabular">
                    {formatRelative(activity.$createdAt, now)}
                  </time>
                </Tooltip>
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
