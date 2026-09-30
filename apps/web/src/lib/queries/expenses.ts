import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import { Query } from 'appwrite'
import { tablesDB } from '../appwrite'
import { addMonths } from '../format'
import { DATABASE_ID, TABLES } from '../ids'
import type { Activity, Category, Expense, ExpenseStatus, LineItem, ReviewFlag } from '../types'

export const PAGE_SIZE = 25

/** Filed expenses have a date. The others are still with the agent or could not be filed. */
export const FILED_STATUSES: ExpenseStatus[] = ['ready', 'needs_review']
export const UNFILED_STATUSES: ExpenseStatus[] = ['processing', 'failed', 'rejected']

export type ExpenseFilters = {
  page: number
  search?: string
  categories?: Category[]
  status?: ExpenseStatus
  /** "2026-09" */
  month?: string
}

export const expenseKeys = {
  all: ['expenses'] as const,
  list: (filters: ExpenseFilters) => ['expenses', 'list', filters] as const,
  unfiled: ['expenses', 'unfiled'] as const,
  one: (expenseId: string) => ['expense', expenseId] as const,
  lineItems: (expenseId: string) => ['lineItems', expenseId] as const,
  flags: (expenseId: string) => ['flags', expenseId] as const,
  activity: (expenseId: string) => ['activity', expenseId] as const,
  recentActivity: ['activity', 'recent'] as const,
  reviewQueue: ['review', 'queue'] as const,
  overview: ['overview'] as const,
}

export function expensesQuery(filters: ExpenseFilters) {
  return queryOptions({
    queryKey: expenseKeys.list(filters),
    queryFn: async () => {
      const queries = [
        Query.equal('status', filters.status ? [filters.status] : FILED_STATUSES),
        Query.orderDesc('spentOn'),
        Query.orderDesc('$createdAt'),
        Query.limit(PAGE_SIZE),
        Query.offset((filters.page - 1) * PAGE_SIZE),
      ]
      // Full-text search on the merchant name. The last word also matches as a prefix.
      if (filters.search) queries.push(Query.search('merchant', filters.search))
      if (filters.categories?.length) queries.push(Query.equal('category', filters.categories))
      if (filters.month) {
        const start = `${filters.month}-01T00:00:00.000Z`
        queries.push(Query.greaterThanEqual('spentOn', start), Query.lessThan('spentOn', addMonths(start, 1)))
      }
      return tablesDB.listRows<Expense>({ databaseId: DATABASE_ID, tableId: TABLES.expenses, queries })
    },
    placeholderData: keepPreviousData,
  })
}

/** Receipts the agent is reading, or could not file. They have no date yet. */
export const unfiledExpensesQuery = queryOptions({
  queryKey: expenseKeys.unfiled,
  queryFn: () =>
    tablesDB.listRows<Expense>({
      databaseId: DATABASE_ID,
      tableId: TABLES.expenses,
      queries: [Query.equal('status', UNFILED_STATUSES), Query.orderDesc('$createdAt'), Query.limit(PAGE_SIZE)],
    }),
})

/**
 * One expense, or null when it does not exist or belongs to someone else.
 * A list query answers both cases with an empty result instead of an error.
 */
export function expenseQuery(expenseId: string) {
  return queryOptions({
    queryKey: expenseKeys.one(expenseId),
    queryFn: async () => {
      const { rows } = await tablesDB.listRows<Expense>({
        databaseId: DATABASE_ID,
        tableId: TABLES.expenses,
        queries: [Query.equal('$id', [expenseId]), Query.limit(1)],
      })
      return rows[0] ?? null
    },
  })
}

export function lineItemsQuery(expenseId: string) {
  return queryOptions({
    queryKey: expenseKeys.lineItems(expenseId),
    queryFn: async () => {
      const { rows } = await tablesDB.listRows<LineItem>({
        databaseId: DATABASE_ID,
        tableId: TABLES.lineItems,
        queries: [Query.equal('expenseId', [expenseId]), Query.orderAsc('position'), Query.limit(100)],
      })
      return rows
    },
  })
}

export function flagsQuery(expenseId: string) {
  return queryOptions({
    queryKey: expenseKeys.flags(expenseId),
    queryFn: async () => {
      const { rows } = await tablesDB.listRows<ReviewFlag>({
        databaseId: DATABASE_ID,
        tableId: TABLES.flags,
        queries: [Query.equal('expenseId', [expenseId]), Query.orderAsc('$createdAt'), Query.limit(20)],
      })
      return rows
    },
  })
}

export function activityQuery(expenseId: string) {
  return queryOptions({
    queryKey: expenseKeys.activity(expenseId),
    queryFn: async () => {
      const { rows } = await tablesDB.listRows<Activity>({
        databaseId: DATABASE_ID,
        tableId: TABLES.activity,
        queries: [Query.equal('expenseId', [expenseId]), Query.orderAsc('$createdAt'), Query.limit(100)],
      })
      return rows
    },
  })
}

/** Expenses with open review flags, oldest first. */
export const reviewQueueQuery = queryOptions({
  queryKey: expenseKeys.reviewQueue,
  queryFn: async () => {
    const { rows } = await tablesDB.listRows<Expense>({
      databaseId: DATABASE_ID,
      tableId: TABLES.expenses,
      queries: [Query.equal('status', ['needs_review']), Query.orderAsc('$createdAt'), Query.limit(100)],
    })
    return rows
  },
})

export type ActivityWithExpense = { activity: Activity; expense: Pick<Expense, '$id' | 'merchant' | 'fileName'> | null }

/** The latest steps across all expenses, with the expense each one belongs to. */
export const recentActivityQuery = queryOptions({
  queryKey: expenseKeys.recentActivity,
  queryFn: async (): Promise<ActivityWithExpense[]> => {
    const { rows: steps } = await tablesDB.listRows<Activity>({
      databaseId: DATABASE_ID,
      tableId: TABLES.activity,
      queries: [Query.orderDesc('$createdAt'), Query.limit(8)],
    })
    const ids = [...new Set(steps.map((step) => step.expenseId))]
    const { rows: expenses } = ids.length
      ? await tablesDB.listRows<Expense>({
          databaseId: DATABASE_ID,
          tableId: TABLES.expenses,
          queries: [Query.equal('$id', ids), Query.select(['merchant', 'fileName']), Query.limit(ids.length)],
        })
      : { rows: [] }
    const byId = new Map(expenses.map((expense) => [expense.$id, expense]))
    return steps.map((activity) => ({ activity, expense: byId.get(activity.expenseId) ?? null }))
  },
})

/** Whether the person has uploaded anything yet. */
export const hasExpensesQuery = queryOptions({
  queryKey: ['expenses', 'any'],
  queryFn: async () => {
    const { rows } = await tablesDB.listRows<Expense>({
      databaseId: DATABASE_ID,
      tableId: TABLES.expenses,
      queries: [Query.select(['$id']), Query.limit(1)],
      total: false,
    })
    return rows.length > 0
  },
})
