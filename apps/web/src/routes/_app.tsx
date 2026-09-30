import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app/AppShell'
import { accountQuery } from '@/lib/queries/account'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(accountQuery)
    if (!user) throw redirect({ to: '/sign-in', search: { redirect: location.href } })
    return { user }
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})
