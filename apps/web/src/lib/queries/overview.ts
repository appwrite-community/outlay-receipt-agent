import { queryOptions } from '@tanstack/react-query'
import { Query } from 'appwrite'
import { tablesDB } from '../appwrite'
import { addMonths, monthKey } from '../format'
import { DATABASE_ID, TABLES } from '../ids'
import type { Category, Expense } from '../types'
import { FILED_STATUSES, expenseKeys } from './expenses'

export const CHART_MONTHS = 6

type OverviewRow = Pick<
  Expense,
  | '$id'
  | '$createdAt'
  | 'spentOn'
  | 'totalMinor'
  | 'currency'
  | 'category'
  | 'status'
  | 'filedInMs'
  | 'correctedFields'
  | 'reviewedAt'
>

const COLUMNS = [
  'spentOn',
  'totalMinor',
  'currency',
  'category',
  'status',
  'filedInMs',
  'correctedFields',
  'reviewedAt',
]

/** The first day of the current month, in UTC like the receipt dates. */
export function currentMonthStart(now = new Date()): string {
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString()
}

/** Every row that matches, a page of 500 at a time. */
async function listAll(queries: string[]): Promise<OverviewRow[]> {
  const rows: OverviewRow[] = []
  let cursor: string | undefined
  do {
    const page = await tablesDB.listRows<Expense>({
      databaseId: DATABASE_ID,
      tableId: TABLES.expenses,
      queries: [
        ...queries,
        Query.select(COLUMNS),
        Query.limit(500),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
      total: false,
    })
    rows.push(...page.rows)
    cursor = page.rows.length === 500 ? page.rows.at(-1)?.$id : undefined
  } while (cursor)
  return rows
}

/**
 * TablesDB has no sum or group-by queries, so the overview loads the few
 * columns it needs for the last six months and adds them up in the browser.
 */
export const overviewQuery = queryOptions({
  queryKey: expenseKeys.overview,
  queryFn: async () => {
    const monthStart = currentMonthStart()
    const [spent, filedThisMonth] = await Promise.all([
      listAll([
        Query.equal('status', FILED_STATUSES),
        Query.greaterThanEqual('spentOn', addMonths(monthStart, 1 - CHART_MONTHS)),
      ]),
      listAll([
        Query.equal('status', FILED_STATUSES),
        Query.greaterThanEqual('$createdAt', monthStart),
      ]),
    ])
    return { monthStart, spent, filedThisMonth }
  },
})

export type MonthTotal = { month: string; totalMinor: number; count: number }
export type CategoryTotal = { category: Category; totalMinor: number; count: number }
export type CurrencyTotal = { currency: string; totalMinor: number; count: number }

export type OverviewSummary = {
  months: MonthTotal[]
  categoriesByMonth: Map<string, CategoryTotal[]>
  otherCurrencies: CurrencyTotal[]
  thisMonth: MonthTotal
  lastMonth: MonthTotal
  filed: { count: number; unaided: number; medianMs: number | null }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

/** Totals in the home currency only. Amounts in other currencies are listed separately. */
export function summarize(
  data: { monthStart: string; spent: OverviewRow[]; filedThisMonth: OverviewRow[] },
  homeCurrency: string,
): OverviewSummary {
  const monthKeys = Array.from({ length: CHART_MONTHS }, (_, index) =>
    monthKey(addMonths(data.monthStart, index + 1 - CHART_MONTHS)),
  )
  const months = new Map<string, MonthTotal>(
    monthKeys.map((month) => [month, { month, totalMinor: 0, count: 0 }]),
  )
  const categories = new Map<string, Map<Category, CategoryTotal>>(
    monthKeys.map((month) => [month, new Map()]),
  )
  const others = new Map<string, CurrencyTotal>()

  for (const row of data.spent) {
    if (row.totalMinor === null || !row.spentOn || !row.currency) continue
    const month = monthKey(row.spentOn)
    if (!months.has(month)) continue

    if (row.currency !== homeCurrency) {
      const other = others.get(row.currency) ?? { currency: row.currency, totalMinor: 0, count: 0 }
      other.totalMinor += row.totalMinor
      other.count += 1
      others.set(row.currency, other)
      continue
    }

    const total = months.get(month)!
    total.totalMinor += row.totalMinor
    total.count += 1

    const category = row.category ?? 'other'
    const byCategory = categories.get(month)!
    const entry = byCategory.get(category) ?? { category, totalMinor: 0, count: 0 }
    entry.totalMinor += row.totalMinor
    entry.count += 1
    byCategory.set(category, entry)
  }

  const monthList = [...months.values()]
  // Filed without your help: never reviewed and never changed by you.
  const unaided = data.filedThisMonth.filter(
    (row) => row.status === 'ready' && row.correctedFields.length === 0 && !row.reviewedAt,
  )

  return {
    months: monthList,
    categoriesByMonth: new Map(
      [...categories].map(([month, totals]) => [
        month,
        [...totals.values()].sort((a, b) => b.totalMinor - a.totalMinor),
      ]),
    ),
    otherCurrencies: [...others.values()].sort((a, b) => b.count - a.count),
    thisMonth: monthList.at(-1)!,
    lastMonth: monthList.at(-2)!,
    filed: {
      count: data.filedThisMonth.length,
      unaided: unaided.length,
      medianMs: median(
        data.filedThisMonth.flatMap((row) => (row.filedInMs === null ? [] : [row.filedInMs])),
      ),
    },
  }
}
