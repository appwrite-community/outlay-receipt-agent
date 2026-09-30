import type { Activity, Expense } from './types'

/** A run that has not written anything for 4 minutes timed out, so it can be retried. */
const STUCK_MS = 4 * 60 * 1000

export function isStuck(expense: Expense, now = Date.now()): boolean {
  return expense.status === 'processing' && now - Date.parse(expense.$updatedAt) > STUCK_MS
}

/** Failed and rejected receipts can go back to the agent, and so can a run that timed out. */
export function canRetry(expense: Expense): boolean {
  return expense.status === 'failed' || expense.status === 'rejected' || isStuck(expense)
}

/** What the agent found when it looked up the merchant, such as the category you chose before. */
export function merchantHistory(steps: Activity[]): string | null {
  return (
    steps.findLast((step) => step.kind === 'lookup' && step.label.startsWith('Looked up'))
      ?.detail ?? null
  )
}
