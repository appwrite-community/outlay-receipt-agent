import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { Logo } from '@/components/app/Logo'
import { accountQuery } from '@/lib/queries/account'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(accountQuery)
    if (user) throw redirect({ to: '/' })
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="dotted-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[58%] left-1/2 size-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(106_92_240/0.22),transparent)] blur-2xl"
      />
      <div className="relative w-full max-w-[400px]">
        <Logo className="mb-8 justify-center" />
        <Outlet />
        <p className="mt-8 text-center text-xs text-fg-3">
          Drop in receipts. The intake agent files them and asks you only about what it could not read.
        </p>
      </div>
    </div>
  )
}
