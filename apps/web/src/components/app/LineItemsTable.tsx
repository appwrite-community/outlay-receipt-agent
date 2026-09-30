import { Skeleton } from '@/components/ui/skeleton'
import { formatMoney } from '@/lib/money'
import type { Expense, LineItem } from '@/lib/types'

/** What the receipt lists, with the tax and the total underneath. */
export function LineItemsTable({ expense, items }: { expense: Expense; items: LineItem[] }) {
  const currency = expense.currency ?? 'USD'
  const money = (minor: number) => formatMoney(minor, currency)

  if (items.length === 0) {
    return <p className="px-1 py-3 text-sm text-fg-2">The receipt lists no separate items.</p>
  }

  return (
    <table className="w-full table-fixed text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs text-fg-3">
          <th className="pb-2 font-medium">Description</th>
          <th className="w-12 pb-2 text-right font-medium">Qty</th>
          <th className="w-24 pb-2 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.$id} className="border-b border-border/70">
            <td className="truncate py-2 pr-3 text-fg" title={item.description}>
              {item.description}
            </td>
            <td className="py-2 text-right text-fg-2 tabular">{item.quantity ?? ''}</td>
            <td className="py-2 text-right text-fg tabular">{money(item.amountMinor)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot className="text-fg-2">
        {expense.taxMinor !== null && expense.taxMinor > 0 && (
          <tr>
            <td colSpan={2} className="pt-2.5">
              Tax
            </td>
            <td className="pt-2.5 text-right tabular">{money(expense.taxMinor)}</td>
          </tr>
        )}
        <tr className="font-medium text-fg">
          <td colSpan={2} className="pt-2">
            Total
          </td>
          <td className="pt-2 text-right tabular">{expense.totalMinor === null ? '-' : money(expense.totalMinor)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

export function LineItemsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 py-1">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex justify-between gap-6">
          <Skeleton className="h-3.5 w-2/5" />
          <Skeleton className="h-3.5 w-16" />
        </div>
      ))}
    </div>
  )
}
