import { FileUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DropOverlay({ visible }: { visible: boolean }) {
  return (
    <div
      aria-hidden={!visible}
      className={cn(
        'pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-bg/80 p-6 backdrop-blur-sm transition-opacity duration-150',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      <div
        className={cn(
          'flex h-full w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-accent-400/60 bg-accent-tint transition-transform duration-200 ease-[var(--ease-out-soft)]',
          visible ? 'scale-100' : 'scale-[0.985]',
        )}
      >
        <div className="grid size-14 place-items-center rounded-xl border border-accent-line bg-surface-1 text-accent-300">
          <FileUp className="size-6" />
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-fg">Drop receipts to file them</p>
          <p className="mt-1 text-sm text-fg-2">JPG, PNG, WEBP, or PDF up to 10 MB</p>
        </div>
      </div>
    </div>
  )
}
