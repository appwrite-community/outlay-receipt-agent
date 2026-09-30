import { cn } from '@/lib/utils'

/** A receipt with a zigzag edge. The violet dot is the agent. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M5.5 20.5V5.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v15l-1.83-1.4-1.84 1.4-1.83-1.4-1.83 1.4-1.84-1.4Z"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <path
        d="M8.75 9h4.5M8.75 12.5h3"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <circle cx={17.75} cy={4.75} r={2.75} fill="var(--logo-tile, #18181d)" />
      <circle cx={17.75} cy={4.75} r={2} fill="var(--color-accent-400)" />
    </svg>
  )
}

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="grid size-7 place-items-center rounded-md border border-border bg-surface-2 text-fg">
        <LogoMark className="size-[18px]" />
      </div>
      <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">Outlay</span>
    </div>
  )
}
