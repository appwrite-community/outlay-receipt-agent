import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Coins,
  FileUp,
  Table2,
} from 'lucide-react'
import { useState } from 'react'
import { CategoryBars } from '@/components/app/CategoryBars'
import { KpiTile, KpiTileSkeleton } from '@/components/app/KpiTile'
import { MonthChart, MonthTable } from '@/components/app/MonthChart'
import { PageHeader } from '@/components/app/PageHeader'
import { RecentActivity } from '@/components/app/RecentActivity'
import { useFilePicker } from '@/components/app/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip } from '@/components/ui/tooltip'
import { formatDuration, formatMonth, formatMonthYear, monthKey, pluralize } from '@/lib/format'
import { formatMoney } from '@/lib/money'
import { accountQuery, homeCurrency } from '@/lib/queries/account'
import { hasExpensesQuery, recentActivityQuery, reviewQueueQuery } from '@/lib/queries/expenses'
import { type OverviewSummary, overviewQuery, summarize } from '@/lib/queries/overview'
import { usePageTitle } from '@/lib/use-page-title'

export const Route = createFileRoute('/_app/')({
  validateSearch: (search: Record<string, unknown>): { month?: string } =>
    typeof search.month === 'string' && /^\d{4}-\d{2}$/.test(search.month)
      ? { month: search.month }
      : {},
  loader: ({ context: { queryClient } }) => {
    void queryClient.prefetchQuery(overviewQuery)
    void queryClient.prefetchQuery(recentActivityQuery)
    void queryClient.prefetchQuery(reviewQueueQuery)
    void queryClient.prefetchQuery(hasExpensesQuery)
  },
  component: Overview,
})

const monthIso = (month: string) => `${month}-01T00:00:00Z`

function SpentDelta({ summary }: { summary: OverviewSummary }) {
  const { thisMonth, lastMonth } = summary
  const lastName = formatMonth(monthIso(lastMonth.month))
  if (lastMonth.totalMinor === 0) return <span>Nothing spent in {lastName}</span>
  const change = Math.round(
    ((thisMonth.totalMinor - lastMonth.totalMinor) / lastMonth.totalMinor) * 100,
  )
  if (change === 0) return <span>Same as {lastName}</span>
  const Icon = change > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5 text-fg-3" />
      {Math.abs(change)}% {change > 0 ? 'more' : 'less'} than {lastName}
    </span>
  )
}

function FirstReceipt() {
  const pickFiles = useFilePicker()
  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <button
        type="button"
        onClick={pickFiles}
        className="group flex w-full max-w-xl flex-col items-center rounded-xl border-2 border-dashed border-border-strong bg-surface-1/60 px-8 py-14 text-center transition-colors hover:border-accent-400/60 hover:bg-accent-tint"
      >
        <span className="grid size-14 place-items-center rounded-xl border border-border bg-surface-2 text-fg-2 transition-colors group-hover:border-accent-line group-hover:text-accent-300">
          <FileUp className="size-6" />
        </span>
        <span className="mt-5 text-lg font-semibold text-fg">Drop your first receipt</span>
        <span className="mt-1.5 max-w-sm text-sm text-fg-2">
          Drag a photo of a paper receipt or a PDF invoice anywhere in Outlay. The agent reads it,
          files the expense, and asks you only about what it could not read.
        </span>
        <span className="mt-6 inline-flex h-8 items-center rounded-sm bg-accent-600 px-3 text-sm font-medium text-white">
          Choose files
        </span>
        <span className="mt-3 text-xs text-fg-3">JPG, PNG, WEBP, or PDF up to 10 MB</span>
      </button>
    </div>
  )
}

function OverviewSkeleton() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <KpiTileSkeleton key={index} />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <Card className="h-[298px] p-4">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-8 h-[196px] w-full" />
          </Card>
          <Card className="h-[272px] p-4">
            <Skeleton className="h-4 w-32" />
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="mt-4 h-4 w-full" />
            ))}
          </Card>
        </div>
        <Card className="h-[586px] p-4">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="mt-5 flex gap-3">
              <Skeleton className="size-6 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  )
}

function Overview() {
  usePageTitle('Overview')
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const [showTable, setShowTable] = useState(false)
  const { data: user } = useQuery(accountQuery)
  const overview = useQuery(overviewQuery)
  const recent = useQuery(recentActivityQuery)
  const queue = useQuery(reviewQueueQuery)
  const hasExpenses = useQuery(hasExpensesQuery)

  const currency = user ? homeCurrency(user) : 'USD'
  const summary = overview.data ? summarize(overview.data, currency) : null
  const currentMonth = summary?.thisMonth.month ?? monthKey(new Date().toISOString())
  const selected = summary?.months.some((month) => month.month === search.month)
    ? search.month!
    : currentMonth
  const selectedTotal = summary?.months.find((month) => month.month === selected)
  const categories = summary?.categoriesByMonth.get(selected) ?? []
  const reviewCount = queue.data?.length ?? 0
  const loading = !summary || !queue.data || hasExpenses.data === undefined

  return (
    <>
      <PageHeader title="Overview" />
      {hasExpenses.data === false ? (
        <FirstReceipt />
      ) : (
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-4 p-4 md:p-6">
          {loading ? (
            <OverviewSkeleton />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <KpiTile
                  label={`Spent in ${formatMonth(monthIso(currentMonth))}`}
                  value={formatMoney(summary.thisMonth.totalMinor, currency)}
                  detail={<SpentDelta summary={summary} />}
                />
                <KpiTile
                  label="Needs review"
                  value={reviewCount}
                  detail={
                    reviewCount > 0 ? (
                      <Link
                        to="/review"
                        className="inline-flex items-center gap-1 text-accent-300 hover:text-fg"
                      >
                        Open the review queue
                        <ArrowRight className="size-3.5" />
                      </Link>
                    ) : (
                      'Nothing is waiting for you'
                    )
                  }
                />
                <KpiTile
                  label={`Filed by the agent in ${formatMonth(monthIso(currentMonth))}`}
                  value={summary.filed.count}
                  detail={
                    summary.filed.count > 0
                      ? `${Math.round((summary.filed.unchanged / summary.filed.count) * 100)}% needed no changes`
                      : 'No receipts filed yet'
                  }
                />
                <KpiTile
                  label="Median time to file"
                  value={
                    summary.filed.medianMs === null ? '-' : formatDuration(summary.filed.medianMs)
                  }
                  detail="From upload to filed, this month"
                />
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="flex min-w-0 flex-col gap-4">
                  <Card>
                    <CardHeader
                      title="Spending by month"
                      description={`In ${currency}, last ${summary.months.length} months. Choose a month to see its categories.`}
                      action={
                        <Tooltip content={showTable ? 'Show as chart' : 'Show as table'}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setShowTable((value) => !value)}
                            aria-label={showTable ? 'Show as chart' : 'Show as table'}
                          >
                            {showTable ? <BarChart3 /> : <Table2 />}
                          </Button>
                        </Tooltip>
                      }
                    />
                    <div className="px-4 pb-3">
                      {showTable ? (
                        <MonthTable months={summary.months} currency={currency} />
                      ) : (
                        <MonthChart
                          months={summary.months}
                          currency={currency}
                          selected={selected}
                          onSelect={(month) =>
                            navigate({
                              search: month === currentMonth ? {} : { month },
                              replace: true,
                              resetScroll: false,
                            })
                          }
                        />
                      )}
                    </div>
                    {summary.otherCurrencies.length > 0 && (
                      <div className="flex flex-col gap-1 border-t border-border px-4 py-2.5">
                        {summary.otherCurrencies.map((other) => (
                          <p
                            key={other.currency}
                            className="flex items-center gap-2 text-xs text-fg-2"
                          >
                            <Coins className="size-3.5 shrink-0 text-fg-3" />
                            <span>
                              <span className="font-medium text-fg tabular">
                                {formatMoney(other.totalMinor, other.currency)}
                              </span>{' '}
                              in {other.currency} across {pluralize(other.count, 'expense')}, not
                              included above
                            </span>
                          </p>
                        ))}
                      </div>
                    )}
                  </Card>

                  <Card className="flex-1">
                    <CardHeader
                      title="By category"
                      description={`${formatMonthYear(monthIso(selected))} · ${formatMoney(selectedTotal?.totalMinor ?? 0, currency)}`}
                      action={
                        selected !== currentMonth && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              navigate({ search: {}, replace: true, resetScroll: false })
                            }
                          >
                            Back to {formatMonth(monthIso(currentMonth))}
                          </Button>
                        )
                      }
                    />
                    <div className="px-2 pb-3">
                      {categories.length > 0 ? (
                        <CategoryBars totals={categories} currency={currency} month={selected} />
                      ) : (
                        <p className="px-2 py-10 text-center text-sm text-fg-2">
                          No spending in {formatMonth(monthIso(selected))} yet
                        </p>
                      )}
                    </div>
                  </Card>
                </div>

                <Card className="min-w-0">
                  <CardHeader
                    title="Recent activity"
                    description="The agent's work and your changes"
                    action={
                      <Button asChild variant="ghost" size="sm">
                        <Link to="/expenses">All expenses</Link>
                      </Button>
                    }
                  />
                  <div className="px-2 pb-2">
                    {recent.data?.length ? (
                      <RecentActivity items={recent.data} />
                    ) : (
                      <p className="px-2 py-10 text-center text-sm text-fg-2">No activity yet</p>
                    )}
                  </div>
                </Card>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}
