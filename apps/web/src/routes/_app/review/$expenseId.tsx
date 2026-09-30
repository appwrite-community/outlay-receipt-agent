import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/review/$expenseId')({
  component: () => null,
})
