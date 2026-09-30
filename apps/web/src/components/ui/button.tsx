import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-[120ms] ease-out select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-accent-600 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] hover:bg-accent-700 active:bg-accent-700',
        secondary: 'border border-border-strong bg-surface-2 text-fg hover:bg-surface-3 active:bg-surface-3',
        ghost: 'text-fg-2 hover:bg-surface-2 hover:text-fg active:bg-surface-3',
        danger: 'bg-crit text-[#1c0808] hover:bg-[#f48585] active:bg-[#f48585]',
        link: 'h-auto px-0 text-accent-300 hover:text-fg hover:underline underline-offset-4',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs [&_svg]:size-3.5',
        md: 'h-8 px-3 text-sm',
        lg: 'h-10 px-4 text-sm',
        icon: 'size-8',
        'icon-sm': 'size-7 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button'
  return <Comp type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
