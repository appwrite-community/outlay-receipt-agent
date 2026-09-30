import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-white/15 px-1 font-mono text-[10.5px] leading-none font-medium text-current opacity-80',
        className,
      )}
      {...props}
    />
  )
}
