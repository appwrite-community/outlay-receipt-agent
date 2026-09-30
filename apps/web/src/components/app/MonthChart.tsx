import { useRef } from 'react'
import { Tooltip } from '@/components/ui/tooltip'
import { formatMonthYear, formatShortMonth, pluralize } from '@/lib/format'
import { formatMoney, formatMoneyCompact } from '@/lib/money'
import type { MonthTotal } from '@/lib/queries/overview'
import { useElementSize } from '@/lib/use-element-size'
import { cn } from '@/lib/utils'

const HEIGHT = 196
const TOP = 26
const BOTTOM = 26
const AXIS = 48
const BAR = 24

/** Rounds up to 1, 2, or 5 times a power of ten, for clean axis ticks. */
function niceMax(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((multiple) => multiple * power >= value) ?? 10
  return step * power
}

/** A column with rounded data-end and a square base. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(4, height)
  return `M${x},${y + height}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + width - radius}Q${x + width},${y} ${x + width},${y + radius}V${y + height}Z`
}

/**
 * Monthly spending in the home currency, one column per month. Choosing a
 * month scopes the category breakdown next to it.
 */
export function MonthChart({
  months,
  currency,
  selected,
  onSelect,
}: {
  months: MonthTotal[]
  currency: string
  selected: string
  onSelect: (month: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const { width } = useElementSize(ref)
  const max = niceMax(Math.max(...months.map((month) => month.totalMinor)))
  const plotWidth = Math.max(0, width - AXIS)
  const slot = plotWidth / months.length
  const plotHeight = HEIGHT - TOP - BOTTOM
  const y = (value: number) => TOP + plotHeight - (value / max) * plotHeight
  const ticks = [0, max / 2, max]

  return (
    <div ref={ref} className="relative" style={{ height: HEIGHT }}>
      {width > 0 && (
        <svg width={width} height={HEIGHT} className="absolute inset-0" aria-hidden>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={AXIS}
                x2={width}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <text
                x={AXIS - 10}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-fg-3 font-mono text-[10.5px] tabular"
              >
                {formatMoneyCompact(tick, currency)}
              </text>
            </g>
          ))}
          {months.map((month, index) => {
            const x = AXIS + slot * index + (slot - BAR) / 2
            const top = y(month.totalMinor)
            const active = month.month === selected
            return (
              <g key={month.month}>
                {month.totalMinor > 0 && (
                  <path
                    d={columnPath(x, top, BAR, TOP + plotHeight - top)}
                    className={cn(
                      'transition-[fill] duration-150',
                      active ? 'fill-accent-400' : 'fill-accent-muted',
                    )}
                  />
                )}
                {active && month.totalMinor > 0 && (
                  <text
                    x={x + BAR / 2}
                    y={top - 8}
                    textAnchor="middle"
                    className="fill-fg text-[11px] font-semibold tabular"
                  >
                    {formatMoneyCompact(month.totalMinor, currency)}
                  </text>
                )}
                <text
                  x={x + BAR / 2}
                  y={HEIGHT - 8}
                  textAnchor="middle"
                  className={cn('text-[11px]', active ? 'fill-fg font-medium' : 'fill-fg-3')}
                >
                  {formatShortMonth(`${month.month}-01T00:00:00Z`)}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      <div className="absolute inset-y-0 right-0 flex" style={{ left: AXIS }}>
        {months.map((month) => (
          <Tooltip
            key={month.month}
            delay={0}
            content={
              <span className="flex flex-col gap-0.5 py-0.5">
                <span className="text-sm font-semibold tabular">
                  {formatMoney(month.totalMinor, currency)}
                </span>
                <span className="text-fg-2">
                  {formatMonthYear(`${month.month}-01T00:00:00Z`)} ·{' '}
                  {pluralize(month.count, 'expense')}
                </span>
              </span>
            }
          >
            <button
              type="button"
              onClick={() => onSelect(month.month)}
              aria-pressed={month.month === selected}
              aria-label={`${formatMonthYear(`${month.month}-01T00:00:00Z`)}: ${formatMoney(month.totalMinor, currency)}`}
              className="group h-full flex-1 rounded-md transition-colors hover:bg-white/[0.025] focus-visible:outline-offset-[-2px]"
            />
          </Tooltip>
        ))}
      </div>
    </div>
  )
}

/** The same numbers as the chart, for screen readers and exact reading. */
export function MonthTable({ months, currency }: { months: MonthTotal[]; currency: string }) {
  return (
    <div className="overflow-hidden rounded-md border border-border" style={{ height: HEIGHT }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-2xs tracking-wider text-fg-3 uppercase">
            <th className="px-3 py-2 font-semibold">Month</th>
            <th className="px-3 py-2 text-right font-semibold">Expenses</th>
            <th className="px-3 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {months.map((month) => (
            <tr key={month.month} className="border-b border-border last:border-0">
              <td className="px-3 py-[3px] text-fg-2">
                {formatMonthYear(`${month.month}-01T00:00:00Z`)}
              </td>
              <td className="px-3 py-[3px] text-right text-fg-2 tabular">{month.count}</td>
              <td className="px-3 py-[3px] text-right text-fg tabular">
                {formatMoney(month.totalMinor, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
