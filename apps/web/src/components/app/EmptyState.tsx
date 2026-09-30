import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon
  title: string
  description?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="grid size-11 place-items-center rounded-lg border border-border bg-surface-2 text-fg-2">
        <Icon className="size-5" />
      </div>
      <p className="mt-4 text-base font-semibold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-2">{description}</p>}
      {children && <div className="mt-5 flex items-center gap-2">{children}</div>}
    </div>
  )
}
