import { Ban, CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'
import type { ExpenseStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const STATUS = {
  processing: {
    label: 'Reading',
    className: 'border-accent-line bg-accent-tint text-accent-300',
    icon: null,
  },
  needs_review: {
    label: 'Needs review',
    className: 'border-warn-line bg-warn-tint text-warn',
    icon: CircleAlert,
  },
  ready: {
    label: 'Filed',
    className: 'border-good-line bg-good-tint text-good',
    icon: CircleCheck,
  },
  failed: {
    label: 'Failed',
    className: 'border-crit-line bg-crit-tint text-crit',
    icon: TriangleAlert,
  },
  rejected: {
    label: 'Not a receipt',
    className: 'border-crit-line bg-crit-tint text-crit',
    icon: Ban,
  },
} satisfies Record<ExpenseStatus, unknown>

export const statusLabel = (status: ExpenseStatus) => STATUS[status].label

/** Status is always shown with an icon and a label, never by color alone. */
export function StatusChip({
  status,
  label,
  className,
}: {
  status: ExpenseStatus
  label?: string
  className?: string
}) {
  const { className: tone, icon: Icon } = STATUS[status]
  return (
    <span
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center gap-1.5 overflow-hidden rounded-sm border px-2 text-xs font-medium whitespace-nowrap',
        tone,
        status === 'processing' && 'agent-sweep',
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" strokeWidth={2} /> : <AgentPulse />}
      {label ?? STATUS[status].label}
    </span>
  )
}

/** The agent's dot, pulsing while it works. */
export function AgentPulse({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex size-2 shrink-0', className)}>
      <span className="absolute inset-0 animate-pulse-dot rounded-full bg-accent-400" />
      <span className="relative m-auto size-1.5 rounded-full bg-accent-400" />
    </span>
  )
}
