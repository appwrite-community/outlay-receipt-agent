import { Link } from '@tanstack/react-router'
import { categoryIcon, categoryLabel } from '@/lib/categories'
import { formatMoney } from '@/lib/money'
import type { CategoryTotal } from '@/lib/queries/overview'

/** Spending per category for one month, largest first. Each row links to the filtered list. */
export function CategoryBars({ totals, currency, month }: { totals: CategoryTotal[]; currency: string; month: string }) {
  const sum = totals.reduce((total, entry) => total + entry.totalMinor, 0)
  const max = Math.max(...totals.map((entry) => entry.totalMinor), 1)

  return (
    <ul className="flex flex-col">
      {totals.map((entry) => {
        const Icon = categoryIcon(entry.category)
        const share = sum ? Math.round((entry.totalMinor / sum) * 100) : 0
        return (
          <li key={entry.category}>
            <Link
              to="/expenses"
              search={{ category: [entry.category], month }}
              className="grid h-[30px] grid-cols-[112px_minmax(0,1fr)_88px_36px] items-center gap-3 rounded-md px-2 transition-colors hover:bg-surface-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm text-fg">
                <Icon className="size-3.5 shrink-0 text-fg-3" />
                <span className="truncate">{categoryLabel(entry.category)}</span>
              </span>
              <span className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                <span
                  className="block h-full rounded-full bg-accent-400 transition-[width] duration-300"
                  style={{ width: `${Math.max(2, (entry.totalMinor / max) * 100)}%` }}
                />
              </span>
              <span className="text-right text-sm text-fg tabular">{formatMoney(entry.totalMinor, currency)}</span>
              <span className="text-right text-xs text-fg-3 tabular">{share}%</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
