import { XIcon } from 'lucide-react'
import { Dialog as SheetPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const Sheet = SheetPrimitive.Root
export const SheetTitle = SheetPrimitive.Title
export const SheetDescription = SheetPrimitive.Description
export const SheetClose = SheetPrimitive.Close

/** A panel that slides in from the right, or from the bottom on small screens. */
export function SheetContent({
  className,
  children,
  overlay = true,
  ...props
}: ComponentProps<typeof SheetPrimitive.Content> & { overlay?: boolean }) {
  return (
    <SheetPrimitive.Portal>
      {overlay && (
        <SheetPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-fade" />
      )}
      <SheetPrimitive.Content
        className={cn(
          'fixed z-50 flex flex-col border-border bg-surface-1 shadow-overlay outline-none',
          'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-xl border-t data-[state=open]:animate-[sheet-up_200ms_var(--ease-out-soft)_both]',
          'md:inset-y-0 md:right-0 md:left-auto md:h-dvh md:max-h-none md:w-[420px] md:rounded-none md:border-t-0 md:border-l md:data-[state=open]:animate-[sheet-in_200ms_var(--ease-out-soft)_both]',
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute top-4 right-4 rounded-sm p-1 text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}
