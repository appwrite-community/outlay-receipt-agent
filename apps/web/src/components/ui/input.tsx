import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'h-8 w-full min-w-0 rounded-sm border border-border-strong bg-surface-2 px-2.5 text-sm text-fg transition-[border-color,background-color] duration-[120ms] outline-none hover:border-[#3d3d46] focus-visible:border-accent-400 focus-visible:bg-surface-3 focus-visible:outline-none aria-invalid:border-crit disabled:opacity-50 [color-scheme:dark]'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputClass, className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(inputClass, 'h-auto min-h-16 resize-none py-1.5', className)} {...props} />
}
