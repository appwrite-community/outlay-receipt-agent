import { Link } from '@tanstack/react-router'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip } from '@/components/ui/tooltip'
import { isStuck } from '@/lib/agent'
import { categoryIcon, categoryLabel } from '@/lib/categories'
import { formatDate } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import type { Expense } from '@/lib/types'
import { cn } from '@/lib/utils'
import { StatusChip } from './StatusChip'

function MerchantCell({ expense }: { expense: Expense }) {
  const Icon = categoryIcon(expense.category)
  const name = expense.merchant ?? expense.fileName
  const link = (
    <Link
      to="/expenses/$expenseId"
      params={{ expenseId: expense.$id }}
      className={cn(
        'block truncate rounded-sm outline-offset-4 after:absolute after:inset-0',
        expense.merchant ? 'font-medium text-fg' : 'font-mono text-xs text-fg-2',
      )}
    >
      {name}
    </Link>
  )
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-fg-2">
        <Icon className="size-3.5" />
      </span>
      {name.length > 40 ? <Tooltip content={name}>{link}</Tooltip> : link}
    </div>
  )
}

/** A value the agent has not read yet shows as a shimmer while it works. */
function Value({
  expense,
  value,
  className,
}: {
  expense: Expense
  value: string | null
  className?: string
}) {
  if (expense.status === 'processing' && !isStuck(expense))
    return <Skeleton className={cn('h-3 w-16', className)} />
  return value ?? <span className="text-fg-3">-</span>
}

const money = (expense: Expense) =>
  expense.totalMinor !== null && expense.currency
    ? formatMoney(expense.totalMinor, expense.currency)
    : null

export function ExpenseRow({ expense }: { expense: Expense }) {
  // The merchant link stretches over the whole row, so the row opens the expense.
  return (
    <TableRow className="relative animate-rise hover:bg-surface-2/70">
      <TableCell className="max-w-0">
        <MerchantCell expense={expense} />
      </TableCell>
      <TableCell className="text-fg-2 tabular">
        <Value
          expense={expense}
          value={expense.spentOn && formatDate(expense.spentOn)}
          className="w-20"
        />
      </TableCell>
      <TableCell className="text-fg-2">
        <Value expense={expense} value={expense.category && categoryLabel(expense.category)} />
      </TableCell>
      <TableCell className="max-w-0 truncate text-fg-2">
        <Value expense={expense} value={expense.paymentMethod} className="w-24" />
      </TableCell>
      <TableCell className="text-right font-medium text-fg tabular">
        <Value expense={expense} value={money(expense)} className="ml-auto w-14" />
      </TableCell>
      <TableCell>
        {isStuck(expense) ? (
          <StatusChip status="failed" label="Stopped" />
        ) : (
          <StatusChip status={expense.status} />
        )}
      </TableCell>
    </TableRow>
  )
}

/** Fixed column widths, so the merchant gets the room and amounts line up on every page. */
export function ExpenseTableHead() {
  return (
    <>
      <colgroup>
        <col className="w-[31%]" />
        <col className="w-[13%]" />
        <col className="w-[12%]" />
        <col className="w-[19%]" />
        <col className="w-[11%]" />
        <col className="w-[14%]" />
      </colgroup>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Merchant</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Paid with</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
    </>
  )
}

export function ExpenseTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <Table className="table-fixed">
      <ExpenseTableHead />
      <TableBody>
        {Array.from({ length: rows }, (_, index) => (
          <TableRow key={index}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Skeleton className="size-7 rounded-md" />
                <Skeleton className="h-3.5 w-40" />
              </div>
            </TableCell>
            <TableCell>
              <Skeleton className="h-3 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-3 w-16" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-3 w-24" />
            </TableCell>
            <TableCell>
              <Skeleton className="ml-auto h-3 w-14" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-16" />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/** Phones get cards instead of a table. */
export function ExpenseCard({ expense }: { expense: Expense }) {
  const Icon = categoryIcon(expense.category)
  return (
    <Link
      to="/expenses/$expenseId"
      params={{ expenseId: expense.$id }}
      className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-surface-2/70"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-surface-2 text-fg-2">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block truncate',
            expense.merchant ? 'font-medium text-fg' : 'font-mono text-xs text-fg-2',
          )}
        >
          {expense.merchant ?? expense.fileName}
        </span>
        <span className="mt-0.5 block truncate text-xs text-fg-3">
          {[
            expense.spentOn && formatDate(expense.spentOn),
            expense.category && categoryLabel(expense.category),
          ]
            .filter(Boolean)
            .join(' · ') || 'Not filed yet'}
        </span>
      </span>
      <span className="flex flex-col items-end gap-1">
        <span className="font-medium text-fg tabular">{money(expense)}</span>
        {expense.status !== 'ready' && <StatusChip status={expense.status} />}
      </span>
    </Link>
  )
}
