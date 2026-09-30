import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const TooltipProvider = TooltipPrimitive.Provider

export function TooltipContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 max-w-72 animate-fade rounded-sm bg-surface-3 px-2 py-1 text-xs text-fg shadow-overlay',
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  )
}

/** Wraps one element with a tooltip. The child must accept a ref. */
export function Tooltip({
  content,
  children,
  side,
  delay,
}: {
  content: ReactNode
  children: ReactNode
  side?: ComponentProps<typeof TooltipPrimitive.Content>['side']
  delay?: number
}) {
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipContent side={side}>{content}</TooltipContent>
    </TooltipPrimitive.Root>
  )
}
