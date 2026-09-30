import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloudOff,
  ReceiptText,
  Search,
  SearchX,
  X,
} from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import {
  ExpenseCard,
  ExpenseRow,
  ExpenseTableHead,
  ExpenseTableSkeleton,
} from '@/components/app/ExpenseTable'
import { EmptyState } from '@/components/app/EmptyState'
import { PageHeader, UploadButton } from '@/components/app/PageHeader'
import { statusLabel } from '@/components/app/StatusChip'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { CATEGORIES, categoryLabel, isCategory } from '@/lib/categories'
import { addMonths, formatMonthYear } from '@/lib/format'
import {
  type ExpenseFilters,
  PAGE_SIZE,
  expensesQuery,
  hasExpensesQuery,
  unfiledExpensesQuery,
} from '@/lib/queries/expenses'
import { currentMonthStart } from '@/lib/queries/overview'
import type { Category, ExpenseStatus } from '@/lib/types'
import { useMediaQuery } from '@/lib/use-media-query'
import { usePageTitle } from '@/lib/use-page-title'
import { cn } from '@/lib/utils'

type Search = {
  page?: number
  q?: string
  category?: Category[]
  status?: ExpenseStatus
  month?: string
}

const STATUSES: ExpenseStatus[] = ['ready', 'needs_review', 'processing', 'failed', 'rejected']

export const Route = createFileRoute('/_app/expenses/')({
  validateSearch: (search: Record<string, unknown>): Search => {
    const page = Number(search.page)
    const categories = (Array.isArray(search.category) ? search.category : []).filter(
      (value): value is Category => typeof value === 'string' && isCategory(value),
    )
    return {
      page: Number.isInteger(page) && page > 1 ? page : undefined,
      q: typeof search.q === 'string' && search.q.trim() ? search.q.trim().slice(0, 64) : undefined,
      category: categories.length ? categories : undefined,
      status: STATUSES.includes(search.status as ExpenseStatus)
        ? (search.status as ExpenseStatus)
        : undefined,
      month:
        typeof search.month === 'string' && /^\d{4}-\d{2}$/.test(search.month)
          ? search.month
          : undefined,
    }
  },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) => {
    void context.queryClient.prefetchQuery(expensesQuery(toFilters(deps)))
  },
  component: Expenses,
})

function toFilters(search: Search): ExpenseFilters {
  return {
    page: search.page ?? 1,
    search: search.q,
    categories: search.category,
    status: search.status,
    month: search.month,
  }
}

const MONTHS = Array.from({ length: 12 }, (_, index) =>
  addMonths(currentMonthStart(), -index).slice(0, 7),
)

function CategoryFilter({
  value,
  onChange,
}: {
  value: Category[]
  onChange: (value: Category[]) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="md"
          className={cn('font-normal', value.length && 'border-accent-line bg-accent-tint text-fg')}
        >
          {value.length === 0
            ? 'Category'
            : value.length === 1
              ? categoryLabel(value[0])
              : `${value.length} categories`}
          <ChevronDown className="text-fg-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52">
        {CATEGORIES.map(({ id, label, icon: Icon }) => {
          const checked = value.includes(id)
          return (
            <label
              key={id}
              className="flex h-8 cursor-default items-center gap-2.5 rounded-[5px] px-2 text-sm hover:bg-surface-3"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={(next) =>
                  onChange(next ? [...value, id] : value.filter((item) => item !== id))
                }
              />
              <Icon className="size-4 text-fg-3" />
              {label}
            </label>
          )
        })}
        {value.length > 0 && (
          <>
            <div className="-mx-1 my-1 h-px bg-border-strong" />
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex h-8 w-full items-center rounded-[5px] px-2 text-sm text-fg-2 hover:bg-surface-3 hover:text-fg"
            >
              Clear categories
            </button>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** "No expenses match 'kinjo' in Meals in August" */
function noResultsText(search: Search): string {
  const parts = ['No expenses']
  if (search.status) parts.push(`with status ${statusLabel(search.status).toLowerCase()}`)
  if (search.q) parts.push(`match "${search.q}"`)
  if (search.category?.length) parts.push(`in ${search.category.map(categoryLabel).join(' or ')}`)
  if (search.month) parts.push(`in ${formatMonthYear(`${search.month}-01T00:00:00Z`)}`)
  return parts.join(' ')
}

function Expenses() {
  usePageTitle('Expenses')
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [query, setQuery] = useState(search.q ?? '')
  const phone = !useMediaQuery('(min-width: 768px)')
  const filters = toFilters(search)
  const list = useQuery(expensesQuery(filters))
  const hasFilters = Boolean(search.q || search.category || search.status || search.month)
  const showUnfiled = filters.page === 1 && !hasFilters
  const unfiled = useQuery({ ...unfiledExpensesQuery, enabled: showUnfiled })
  const hasExpenses = useQuery(hasExpensesQuery)

  function update(next: Partial<Search>) {
    navigate({ search: (previous) => ({ ...previous, page: undefined, ...next }), replace: true })
  }

  // Search as you type, a moment after the last key.
  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed === (search.q ?? '')) return
    const timer = window.setTimeout(() => update({ q: trimmed || undefined }), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const rows = list.data?.rows ?? []
  const total = list.data?.total ?? 0
  const unfiledRows = showUnfiled ? (unfiled.data?.rows ?? []) : []
  const first = total === 0 ? 0 : (filters.page - 1) * PAGE_SIZE + 1
  const last = Math.min(total, filters.page * PAGE_SIZE)
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  let body: ReactNode
  if (list.isError) {
    body = (
      <EmptyState
        icon={CloudOff}
        title="Could not load your expenses"
        description="Check your connection, then try again."
      >
        <Button onClick={() => list.refetch()}>Try again</Button>
      </EmptyState>
    )
  } else if (!list.data || hasExpenses.data === undefined) {
    body = <ExpenseTableSkeleton rows={phone ? 6 : 12} />
  } else if (rows.length === 0 && unfiledRows.length === 0) {
    body = hasFilters ? (
      <EmptyState
        icon={SearchX}
        title={noResultsText(search)}
        description="Try a different search, or clear the filters."
      >
        <Button
          onClick={() => {
            setQuery('')
            navigate({ search: {}, replace: true })
          }}
        >
          Clear filters
        </Button>
      </EmptyState>
    ) : (
      <EmptyState
        icon={ReceiptText}
        title="No expenses yet"
        description="Upload a receipt or an invoice. The agent reads it and files the expense here."
      >
        <UploadButton />
      </EmptyState>
    )
  } else if (phone) {
    body = (
      <div className="rounded-lg border border-border bg-surface-1">
        {[...unfiledRows, ...rows].map((expense) => (
          <ExpenseCard key={expense.$id} expense={expense} />
        ))}
      </div>
    )
  } else {
    body = (
      <div
        className={cn('transition-opacity duration-150', list.isPlaceholderData && 'opacity-60')}
      >
        <Table className="table-fixed">
          <ExpenseTableHead />
          <TableBody>
            {unfiledRows.length > 0 && (
              <>
                <TableRow className="bg-surface-1 hover:bg-surface-1">
                  <TableCell
                    colSpan={6}
                    className="h-8 text-2xs font-semibold tracking-[0.06em] text-fg-3 uppercase"
                  >
                    Not filed yet · {unfiledRows.length}
                  </TableCell>
                </TableRow>
                {unfiledRows.map((expense) => (
                  <ExpenseRow key={expense.$id} expense={expense} />
                ))}
                {rows.length > 0 && (
                  <TableRow className="bg-surface-1 hover:bg-surface-1">
                    <TableCell
                      colSpan={6}
                      className="h-8 text-2xs font-semibold tracking-[0.06em] text-fg-3 uppercase"
                    >
                      Filed
                    </TableCell>
                  </TableRow>
                )}
              </>
            )}
            {rows.map((expense) => (
              <ExpenseRow key={expense.$id} expense={expense} />
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  // In the top bar from 640 px, above the filters on phones.
  const searchField = (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-3" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setQuery('')
        }}
        placeholder="Search merchants"
        aria-label="Search merchants"
        className="pl-8"
      />
    </div>
  )

  return (
    <>
      <PageHeader title="Expenses">
        <div className="hidden w-64 sm:block">{searchField}</div>
      </PageHeader>
      <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-3 p-4 md:px-6 md:pt-4 md:pb-6">
        <div className="sm:hidden">{searchField}</div>
        <div className="flex flex-wrap items-center gap-2">
          <CategoryFilter
            value={search.category ?? []}
            onChange={(category) => update({ category: category.length ? category : undefined })}
          />
          <Select
            value={search.status ?? 'all'}
            onValueChange={(value) =>
              update({ status: value === 'all' ? undefined : (value as ExpenseStatus) })
            }
          >
            <SelectTrigger
              className={cn(
                'w-auto min-w-36',
                search.status && 'border-accent-line bg-accent-tint',
              )}
              aria-label="Status"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any status</SelectItem>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={search.month ?? 'all'}
            onValueChange={(value) => update({ month: value === 'all' ? undefined : value })}
          >
            <SelectTrigger
              className={cn('w-auto min-w-36', search.month && 'border-accent-line bg-accent-tint')}
              aria-label="Month"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any month</SelectItem>
              {MONTHS.map((month) => (
                <SelectItem key={month} value={month}>
                  {formatMonthYear(`${month}-01T00:00:00Z`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              onClick={() => {
                setQuery('')
                navigate({ search: {}, replace: true })
              }}
            >
              <X />
              Clear
            </Button>
          )}
          <div className="ml-auto flex items-center gap-2">
            {total > 0 && (
              <span className="text-xs text-fg-2 tabular">
                {first}-{last} of {total}
              </span>
            )}
            <Button
              size="icon"
              aria-label="Previous page"
              disabled={filters.page <= 1}
              onClick={() =>
                navigate({
                  search: (previous) => ({
                    ...previous,
                    page: filters.page - 1 > 1 ? filters.page - 1 : undefined,
                  }),
                })
              }
            >
              <ChevronLeft />
            </Button>
            <Button
              size="icon"
              aria-label="Next page"
              disabled={filters.page >= pages}
              onClick={() =>
                navigate({ search: (previous) => ({ ...previous, page: filters.page + 1 }) })
              }
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-bg">{body}</div>
      </div>
    </>
  )
}
