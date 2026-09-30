import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

/** The agent's avatar: the accent dot from the logo. */
export function AgentAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-full border border-accent-line bg-accent-tint',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-accent-400" />
    </span>
  )
}

export function UserAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-full border border-border-strong bg-surface-3 text-[9px] font-semibold tracking-wide text-fg-2',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}
