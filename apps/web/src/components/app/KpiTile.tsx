import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export function KpiTile({ label, value, detail }: { label: string; value: ReactNode; detail: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col rounded-lg border border-border bg-surface-1 px-4 py-3.5">
      <p className="truncate text-xs font-medium text-fg-2">{label}</p>
      <p className="mt-1.5 truncate text-xl font-semibold tracking-[-0.02em] text-fg">{value}</p>
      <div className="mt-1 truncate text-xs text-fg-2">{detail}</div>
    </div>
  )
}

export function KpiTileSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface-1 px-4 py-3.5">
      <Skeleton className="my-0.5 h-3 w-28" />
      <Skeleton className="mt-2.5 h-7 w-32" />
      <Skeleton className="mt-2 h-3 w-36" />
    </div>
  )
}
