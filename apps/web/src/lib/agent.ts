import { useState } from 'react'
import { toast } from 'sonner'
import { retryExpense } from './queries/changes'
import { errorMessage } from './query-client'
import type { Activity, Expense } from './types'

/** A run that has not written anything for 4 minutes timed out, so it can be retried. */
const STUCK_MS = 4 * 60 * 1000

export function isStuck(expense: Expense, now = Date.now()): boolean {
  return expense.status === 'processing' && now - Date.parse(expense.$updatedAt) > STUCK_MS
}

/** Failed and rejected receipts can go back to the agent, and so can a run that timed out. */
export function canRetry(expense: Expense, now = Date.now()): boolean {
  return expense.status === 'failed' || expense.status === 'rejected' || isStuck(expense, now)
}

/** The steps of the run in progress: everything since the last Retry, or all of them. */
export function currentRun(steps: Activity[]): Activity[] {
  const start = steps.findLastIndex((step) => step.kind === 'retried')
  return start < 0 ? steps : steps.slice(start)
}

/** What the agent found when it looked up the merchant, such as the category you chose before. */
export function merchantHistory(steps: Activity[]): string | null {
  return (
    steps.findLast((step) => step.kind === 'lookup' && step.label.startsWith('Looked up'))
      ?.detail ?? null
  )
}

/**
 * Asks the agent to read a receipt again. `retrying` stays true until the agent
 * picks the expense up and its row changes, so a second Retry or a Delete
 * cannot race the new run.
 */
export function useRetry(expense: Expense | null | undefined) {
  const [retriedAt, setRetriedAt] = useState<string | null>(null)
  const retrying = expense != null && retriedAt === expense.$updatedAt

  async function retry() {
    if (!expense) return
    setRetriedAt(expense.$updatedAt)
    try {
      await retryExpense(expense)
      toast.success('The agent is reading the receipt again')
    } catch (error) {
      setRetriedAt(null)
      toast.error(errorMessage(error, 'Could not start the agent. Try again.'))
    }
  }

  return { retry, retrying }
}
