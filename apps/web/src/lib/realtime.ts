import { Channel, type RealtimeResponseEvent } from 'appwrite'
import { useEffect } from 'react'
import { realtime } from './appwrite'
import { DATABASE_ID, TABLES } from './ids'
import { expenseKeys } from './queries/expenses'
import { queryClient } from './query-client'
import type { Activity, Expense, ReviewFlag } from './types'

type RowEvent = 'create' | 'update' | 'delete'

// Events sent while the connection was down are lost. Reload everything after a reconnect.
let connectedBefore = false
realtime.onOpen(() => {
  if (connectedBefore) queryClient.invalidateQueries()
  connectedBefore = true
})

/** "tablesdb.outlay.tables.expenses.rows.<id>.update" -> "update" */
function rowEvent(event: RealtimeResponseEvent<unknown>): RowEvent | null {
  for (const name of event.events) {
    if (!name.startsWith('tablesdb.')) continue
    const action = name.split('.').at(-1)
    if (action === 'create' || action === 'update' || action === 'delete') return action
    if (action === 'upsert') return 'update'
  }
  return null
}

/**
 * Keeps every cached query in step with the database while the app is open.
 * Appwrite only sends events for rows the signed-in user can read, so each
 * person sees their own expenses and the agent's steps on them.
 */
export function useRealtimeSync(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    function onExpense(action: RowEvent, expense: Expense) {
      queryClient.setQueryData(expenseKeys.one(expense.$id), action === 'delete' ? null : expense)
      // Leave the review queue at once, so the next screen never offers a filed expense.
      if (action === 'delete' || expense.status !== 'needs_review') {
        queryClient.setQueryData<Expense[]>(expenseKeys.reviewQueue, (queue) =>
          queue?.filter((item) => item.$id !== expense.$id),
        )
      }
      if (action === 'update') {
        // The agent saves line items and flags in bulk, which sends no row events. Load them again.
        queryClient.invalidateQueries({ queryKey: expenseKeys.lineItems(expense.$id) })
        queryClient.invalidateQueries({ queryKey: expenseKeys.flags(expense.$id) })
      }
      queryClient.invalidateQueries({ queryKey: expenseKeys.all })
      queryClient.invalidateQueries({ queryKey: expenseKeys.reviewQueue })
      queryClient.invalidateQueries({ queryKey: expenseKeys.overview })
    }

    function onActivity(action: RowEvent, step: Activity) {
      queryClient.setQueryData<Activity[]>(expenseKeys.activity(step.expenseId), (steps) => {
        if (!steps) return steps
        const others = steps.filter((item) => item.$id !== step.$id)
        return action === 'delete'
          ? others
          : [...others, step].sort((a, b) => a.$createdAt.localeCompare(b.$createdAt))
      })
      queryClient.invalidateQueries({ queryKey: expenseKeys.recentActivity })
    }

    // Flags you resolve in another tab. The agent's own flags arrive with the expense update.
    function onFlag(flag: ReviewFlag) {
      queryClient.invalidateQueries({ queryKey: expenseKeys.flags(flag.expenseId) })
    }

    const subscription = realtime.subscribe(
      [
        Channel.tablesdb(DATABASE_ID).table(TABLES.expenses).row(),
        Channel.tablesdb(DATABASE_ID).table(TABLES.activity).row(),
        Channel.tablesdb(DATABASE_ID).table(TABLES.flags).row(),
      ],
      (event: RealtimeResponseEvent<Expense | Activity | ReviewFlag>) => {
        const action = rowEvent(event)
        if (!action) return
        if (event.payload.$tableId === TABLES.expenses) onExpense(action, event.payload as Expense)
        if (event.payload.$tableId === TABLES.activity)
          onActivity(action, event.payload as Activity)
        if (event.payload.$tableId === TABLES.flags) onFlag(event.payload as ReviewFlag)
      },
    )

    return () => {
      subscription.then((active) => active.unsubscribe())
    }
  }, [enabled])
}
