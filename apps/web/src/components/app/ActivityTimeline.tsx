import { useQuery } from '@tanstack/react-query'
import {
  Ban,
  Check,
  CircleAlert,
  Inbox,
  type LucideIcon,
  ScanText,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { Tooltip } from '@/components/ui/tooltip'
import { formatDateTime, formatDuration, formatRelative } from '@/lib/format'
import { accountQuery } from '@/lib/queries/account'
import type { Activity, ActivityKind } from '@/lib/types'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'
import { UserAvatar } from './Avatar'

const AGENT_ICONS: Partial<Record<ActivityKind, { icon: LucideIcon; tone: string }>> = {
  received: { icon: Inbox, tone: 'text-accent-300 bg-accent-tint border-accent-line' },
  reading: { icon: ScanText, tone: 'text-accent-300 bg-accent-tint border-accent-line' },
  lookup: { icon: Search, tone: 'text-accent-300 bg-accent-tint border-accent-line' },
  filed: { icon: Check, tone: 'text-good bg-good-tint border-good-line' },
  flagged: { icon: CircleAlert, tone: 'text-warn bg-warn-tint border-warn-line' },
  rejected: { icon: Ban, tone: 'text-crit bg-crit-tint border-crit-line' },
  failed: { icon: TriangleAlert, tone: 'text-crit bg-crit-tint border-crit-line' },
}

// Agent steps that end a run carry how long the whole run took.
const RUN_ENDS: ActivityKind[] = ['filed', 'flagged', 'rejected', 'failed']

export function StepAvatar({
  step,
  userName,
  live,
}: {
  step: Activity
  userName: string
  live?: boolean
}) {
  if (step.actor === 'user') return <UserAvatar name={userName} className="size-6 text-[9px]" />
  const { icon: Icon, tone } = AGENT_ICONS[step.kind] ?? AGENT_ICONS.reading!
  return (
    <span
      className={cn('relative grid size-6 shrink-0 place-items-center rounded-full border', tone)}
    >
      {live && (
        <span className="absolute -inset-1 animate-pulse-dot rounded-full border border-accent-400/50" />
      )}
      <Icon className="size-3" strokeWidth={2.25} />
    </span>
  )
}

/** When a step happened: seconds into the agent's run, or a relative time. */
function stepTime(step: Activity, runStart: Activity | undefined, now: number): string {
  if (step.durationMs !== null && RUN_ENDS.includes(step.kind))
    return formatDuration(step.durationMs)
  if (step.actor === 'agent' && runStart && runStart.$id !== step.$id) {
    return `+${formatDuration(Date.parse(step.$createdAt) - Date.parse(runStart.$createdAt))}`
  }
  return formatRelative(step.$createdAt, now)
}

/** Each agent run starts with "received" or with a retry. */
function runStarts(steps: Activity[]): (Activity | undefined)[] {
  let start: Activity | undefined
  return steps.map((step) => {
    if (step.kind === 'received' || step.kind === 'retried') start = step
    else if (step.actor === 'user') start = undefined
    return start
  })
}

/**
 * The expense's timeline: what the agent did and what you changed, in order.
 * While the agent works, the latest step pulses and new steps arrive through Realtime.
 */
export function ActivityTimeline({
  steps,
  working,
  compact = false,
}: {
  steps: Activity[]
  working: boolean
  compact?: boolean
}) {
  const { data: user } = useQuery(accountQuery)
  const now = useNow(30_000)
  const starts = runStarts(steps)
  const userName = user?.name ?? 'You'

  return (
    <ol className="relative flex flex-col" aria-live="polite">
      {steps.map((step, index) => {
        const last = index === steps.length - 1
        const live = working && last && step.actor === 'agent'
        const time = stepTime(step, starts[index], now)
        return (
          <li
            key={step.$id}
            className={cn(
              'relative flex animate-rise gap-3',
              compact ? 'pb-2.5' : 'pb-4',
              last && 'pb-0',
            )}
          >
            {!last && (
              <span
                aria-hidden
                className="absolute top-7 bottom-1 left-3 w-px -translate-x-1/2 bg-border-strong"
              />
            )}
            <StepAvatar step={step} userName={userName} live={live} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline gap-3">
                <p
                  className={cn(
                    'min-w-0 flex-1 text-sm text-fg',
                    compact ? 'truncate text-xs leading-5' : 'font-medium',
                    live && 'text-accent-300',
                  )}
                >
                  {step.label}
                </p>
                <Tooltip content={formatDateTime(step.$createdAt)}>
                  <time
                    dateTime={step.$createdAt}
                    className="shrink-0 font-mono text-2xs text-fg-3 tabular"
                  >
                    {time}
                  </time>
                </Tooltip>
              </div>
              {!compact && (
                <p className="mt-0.5 text-xs text-fg-2">
                  <span className="text-fg-3">{step.actor === 'agent' ? 'Agent' : 'You'}</span>
                  {step.detail && <span className="text-fg-3"> · </span>}
                  {step.detail}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
