import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { Toaster } from 'sonner'
import { NotFound } from '@/components/app/NotFound'
import { TooltipProvider } from '@/components/ui/tooltip'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  notFoundComponent: NotFound,
})

function Root() {
  return (
    <TooltipProvider delayDuration={400}>
      <Outlet />
      <Toaster
        position="bottom-right"
        theme="dark"
        gap={8}
        toastOptions={{
          classNames: {
            toast: '!rounded-lg !border !border-border-strong !bg-surface-2 !text-fg !shadow-overlay !font-sans !text-sm',
            description: '!text-fg-2',
            success: '[&_[data-icon]]:!text-good',
            error: '[&_[data-icon]]:!text-crit',
          },
        }}
      />
    </TooltipProvider>
  )
}
