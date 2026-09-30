import { useQuery } from '@tanstack/react-query'
import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { CircleCheck } from 'lucide-react'
import { useEffect } from 'react'
import { EmptyState } from '@/components/app/EmptyState'
import { PageHeader } from '@/components/app/PageHeader'
import { Button } from '@/components/ui/button'
import { reviewQueueQuery } from '@/lib/queries/expenses'
import { usePageTitle } from '@/lib/use-page-title'

export const Route = createFileRoute('/_app/review/')({
  // Open the oldest expense that needs you. Ask the server, since this page is
  // where the review screen goes right after the last flag is resolved.
  loader: async ({ context: { queryClient } }) => {
    const queue = await queryClient.fetchQuery(reviewQueueQuery)
    if (queue.length > 0)
      throw redirect({
        to: '/review/$expenseId',
        params: { expenseId: queue[0].$id },
        replace: true,
      })
  },
  component: ReviewEmpty,
})

function ReviewEmpty() {
  usePageTitle('Review')
  const navigate = useNavigate()
  const { data: queue = [] } = useQuery(reviewQueueQuery)

  // A receipt the agent flags while this page is open goes straight to review.
  useEffect(() => {
    if (queue.length > 0)
      void navigate({
        to: '/review/$expenseId',
        params: { expenseId: queue[0].$id },
        replace: true,
      })
  }, [queue, navigate])

  return (
    <>
      <PageHeader title="Review" />
      <div className="grid flex-1 place-items-center">
        <EmptyState
          icon={CircleCheck}
          title="Nothing to review"
          description="The agent files receipts on its own when it can read every field. Anything it is unsure about shows up here."
        >
          <Button asChild>
            <Link to="/expenses">Go to expenses</Link>
          </Button>
        </EmptyState>
      </div>
    </>
  )
}
