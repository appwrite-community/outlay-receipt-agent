import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useFilePicker } from './AppShell'

export function UploadButton() {
  const pickFiles = useFilePicker()
  return (
    <Tooltip content="Upload receipts or drop them anywhere">
      <Button variant="primary" onClick={pickFiles} className="md:pr-2">
        Upload
        <Kbd className="ml-0.5 hidden border-white/25 text-white md:inline-flex">U</Kbd>
      </Button>
    </Tooltip>
  )
}

/** The 56 px bar at the top of every page: title on the left, actions and Upload on the right. */
export function PageHeader({ title, children, className }: { title: ReactNode; children?: ReactNode; className?: string }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur-md md:px-6',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 text-md font-semibold text-fg">{title}</div>
      {children}
      <UploadButton />
    </header>
  )
}
