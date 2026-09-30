import { DropdownMenu as MenuPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export const DropdownMenu = MenuPrimitive.Root
export const DropdownMenuTrigger = MenuPrimitive.Trigger

export const menuContentClass =
  'z-50 min-w-44 overflow-hidden rounded-md bg-surface-2 p-1 shadow-overlay data-[state=open]:animate-[menu-in_120ms_ease-out_both]'
export const menuItemClass =
  'relative flex h-8 cursor-default items-center gap-2 rounded-[5px] px-2 text-sm text-fg outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-3 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-fg-3'

export function DropdownMenuContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof MenuPrimitive.Content>) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Content sideOffset={sideOffset} className={cn(menuContentClass, className)} {...props} />
    </MenuPrimitive.Portal>
  )
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof MenuPrimitive.Item>) {
  return <MenuPrimitive.Item className={cn(menuItemClass, className)} {...props} />
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof MenuPrimitive.Label>) {
  return <MenuPrimitive.Label className={cn('px-2 py-1.5 text-xs text-fg-3', className)} {...props} />
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn('-mx-1 my-1 h-px bg-border-strong', className)} {...props} />
}
