import { ExecutionMethod, ID, Permission, Query, Role } from 'appwrite'
import { functions, storage, tablesDB } from '../appwrite'
import { FIELD_LABELS, displayValue, fieldData, fieldValue, type FieldValues } from '../fields'
import { BUCKET_ID, DATABASE_ID, FUNCTION_ID, TABLES } from '../ids'
import { queryClient } from '../query-client'
import type { Activity, ActivityKind, Expense, ExpenseField, FlagResolution, ReviewFlag } from '../types'
import { expenseKeys } from './expenses'

/** A timeline step written by the signed-in person. Only they can read or delete it. */
function userStep(expense: Expense, kind: ActivityKind, label: string, detail: string | null = null) {
  const owner = Role.user(expense.ownerId)
  return {
    databaseId: DATABASE_ID,
    tableId: TABLES.activity,
    rowId: ID.unique(),
    data: { expenseId: expense.$id, actor: 'user' as const, kind, label, detail, durationMs: null },
    permissions: [Permission.read(owner), Permission.delete(owner)],
  }
}

/** Runs `stage` inside a transaction, then commits. Nothing is saved if any step fails. */
async function inTransaction(stage: (transactionId: string) => Promise<void>): Promise<void> {
  const { $id: transactionId } = await tablesDB.createTransaction({ ttl: 60 })
  try {
    await stage(transactionId)
    await tablesDB.updateTransaction({ transactionId, commit: true })
  } catch (error) {
    await tablesDB.updateTransaction({ transactionId, rollback: true }).catch(() => {})
    throw error
  }
}

/** New values for the expense row after some flags are resolved. */
function reviewState(expense: Expense, openFlagsLeft: number): Partial<Expense> {
  return {
    openFlags: openFlagsLeft,
    status: openFlagsLeft > 0 ? 'needs_review' : 'ready',
    reviewedAt: openFlagsLeft > 0 ? expense.reviewedAt : new Date().toISOString(),
  }
}

function changeLabel(field: ExpenseField, from: string, to: string): string {
  return `You changed ${FIELD_LABELS[field].noun} from ${from} to ${to}`
}

/**
 * Resolves one review flag. The flag, the expense, and a new timeline step
 * are saved in one transaction, so the expense never shows a resolved flag
 * with an out-of-date status.
 */
export async function resolveFlag(input: {
  expense: Expense
  flag: ReviewFlag
  openFlags: ReviewFlag[]
  resolution: FlagResolution
  value?: FieldValues[ExpenseField]
}): Promise<void> {
  const { expense, flag, resolution } = input
  const openFlagsLeft = input.openFlags.filter((open) => open.$id !== flag.$id).length
  const expenseData: Partial<Expense> = reviewState(expense, openFlagsLeft)
  let step: ReturnType<typeof userStep>

  if (resolution === 'corrected' && flag.field !== 'lineItems' && flag.field !== 'duplicate') {
    const field = flag.field
    const currency = field === 'currency' ? (input.value as string) : expense.currency
    Object.assign(expenseData, fieldData(field, input.value ?? null), {
      correctedFields: [...new Set([...expense.correctedFields, field])],
    })
    step = userStep(
      expense,
      'corrected',
      changeLabel(field, displayValue(field, fieldValue(expense, field), expense.currency), displayValue(field, input.value ?? null, currency)),
    )
  } else if (resolution === 'dismissed') {
    step = userStep(expense, 'dismissed', 'You kept both expenses', flag.reason)
  } else {
    step = userStep(expense, 'confirmed', `You confirmed ${FIELD_LABELS[flag.field].noun}`)
  }

  await inTransaction(async (transactionId) => {
    await tablesDB.updateRow<ReviewFlag>({
      databaseId: DATABASE_ID,
      tableId: TABLES.flags,
      rowId: flag.$id,
      data: { status: 'resolved', resolution, resolvedAt: new Date().toISOString() },
      transactionId,
    })
    await tablesDB.updateRow<Expense>({
      databaseId: DATABASE_ID,
      tableId: TABLES.expenses,
      rowId: expense.$id,
      data: expenseData,
      transactionId,
    })
    await tablesDB.createRow<Activity>({ ...step, transactionId })
  })
  await queryClient.invalidateQueries({ queryKey: expenseKeys.flags(expense.$id) })
}

/**
 * Saves changes a person made to an expense. Changed fields are recorded in
 * `correctedFields`, which the agent reads to learn the categories you prefer,
 * and open flags on those fields count as resolved.
 */
export async function updateExpense(input: {
  expense: Expense
  openFlags: ReviewFlag[]
  values: Partial<FieldValues>
  note: string | null
}): Promise<void> {
  const { expense } = input
  const nextCurrency = input.values.currency ?? expense.currency
  const changed = (Object.keys(input.values) as ExpenseField[]).filter(
    (field) => input.values[field] !== fieldValue(expense, field),
  )
  const noteChanged = (input.note ?? null) !== (expense.note ?? null)
  if (changed.length === 0 && !noteChanged) return

  const resolved = input.openFlags.filter((flag) => (changed as string[]).includes(flag.field))
  const data: Partial<Expense> = {}
  const steps: ReturnType<typeof userStep>[] = []

  for (const field of changed) {
    const value = input.values[field] ?? null
    Object.assign(data, fieldData(field, value))
    steps.push(
      userStep(
        expense,
        'corrected',
        changeLabel(
          field,
          displayValue(field, fieldValue(expense, field), expense.currency),
          displayValue(field, value, field === 'currency' ? (value as string) : nextCurrency),
        ),
      ),
    )
  }
  if (changed.length > 0) data.correctedFields = [...new Set([...expense.correctedFields, ...changed])]
  if (resolved.length > 0) Object.assign(data, reviewState(expense, input.openFlags.length - resolved.length))

  if (noteChanged) {
    data.note = input.note
    const label = !input.note ? 'You removed the note' : expense.note ? 'You changed the note' : 'You added a note'
    steps.push(userStep(expense, 'updated', label, input.note))
  }

  await inTransaction(async (transactionId) => {
    await tablesDB.updateRow<Expense>({ databaseId: DATABASE_ID, tableId: TABLES.expenses, rowId: expense.$id, data, transactionId })
    for (const flag of resolved) {
      await tablesDB.updateRow<ReviewFlag>({
        databaseId: DATABASE_ID,
        tableId: TABLES.flags,
        rowId: flag.$id,
        data: { status: 'resolved', resolution: 'corrected', resolvedAt: new Date().toISOString() },
        transactionId,
      })
    }
    for (const step of steps) await tablesDB.createRow<Activity>({ ...step, transactionId })
  })
  if (resolved.length > 0) await queryClient.invalidateQueries({ queryKey: expenseKeys.flags(expense.$id) })
}

/** IDs of the rows in `tableId` that belong to one expense. */
async function rowIdsOf(tableId: string, expenseId: string): Promise<string[]> {
  const { rows } = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId,
    queries: [Query.equal('expenseId', [expenseId]), Query.select(['$id']), Query.limit(200)],
  })
  return rows.map((row) => row.$id)
}

/**
 * Deletes an expense with its line items, flags, and timeline in one
 * transaction, then the receipt file. The owner has delete permission on all of them.
 */
export async function deleteExpense(expense: Expense): Promise<void> {
  const children = await Promise.all(
    [TABLES.lineItems, TABLES.flags, TABLES.activity].map(async (tableId) =>
      (await rowIdsOf(tableId, expense.$id)).map((rowId) => ({ tableId, rowId })),
    ),
  )
  const rows = [...children.flat(), { tableId: TABLES.expenses, rowId: expense.$id }]

  await inTransaction(async (transactionId) => {
    await tablesDB.createOperations({
      transactionId,
      operations: rows.map(({ tableId, rowId }) => ({ action: 'delete', databaseId: DATABASE_ID, tableId, rowId })),
    })
  })
  await storage.deleteFile({ bucketId: BUCKET_ID, fileId: expense.$id })

  queryClient.setQueryData(expenseKeys.one(expense.$id), null)
  await queryClient.invalidateQueries({ queryKey: expenseKeys.all })
}

/** Asks the intake agent to read a failed or rejected receipt again. */
export async function retryExpense(expense: Expense): Promise<void> {
  await functions.createExecution({
    functionId: FUNCTION_ID,
    body: JSON.stringify({ expenseId: expense.$id }),
    async: true,
    method: ExecutionMethod.POST,
  })
}
