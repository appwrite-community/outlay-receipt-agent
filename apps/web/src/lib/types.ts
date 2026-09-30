import type { Models } from 'appwrite'

export type Category =
  | 'meals'
  | 'travel'
  | 'lodging'
  | 'transport'
  | 'software'
  | 'equipment'
  | 'office'
  | 'fees'
  | 'other'

export type ExpenseStatus = 'processing' | 'needs_review' | 'ready' | 'failed' | 'rejected'

/** The expense fields a person can review or change. */
export type ExpenseField = 'merchant' | 'spentOn' | 'total' | 'tax' | 'currency' | 'category' | 'paymentMethod'

export type FieldNote = { confidence: 'medium' | 'low'; note: string | null }

/** One uploaded receipt. The row ID is the ID of the receipt file. */
export type Expense = Models.Row & {
  ownerId: string
  status: ExpenseStatus
  fileName: string
  mimeType: string
  sizeBytes: number | null
  viewToken: string | null
  merchant: string | null
  spentOn: string | null
  totalMinor: number | null
  taxMinor: number | null
  currency: string | null
  category: Category | null
  paymentMethod: string | null
  note: string | null
  agentSummary: string | null
  fieldNotes: string | null
  correctedFields: string[]
  openFlags: number | null
  duplicateOf: string | null
  failureReason: string | null
  model: string | null
  filedInMs: number | null
  reviewedAt: string | null
}

export type LineItem = Models.Row & {
  expenseId: string
  position: number
  description: string
  quantity: number | null
  amountMinor: number
}

export type FlagField = ExpenseField | 'lineItems' | 'duplicate'

export type FlagResolution = 'confirmed' | 'corrected' | 'dismissed'

export type ReviewFlag = Models.Row & {
  expenseId: string
  field: FlagField
  source: 'model' | 'check'
  reason: string
  agentValue: string | null
  relatedExpenseId: string | null
  status: 'open' | 'resolved' | null
  resolution: FlagResolution | null
  resolvedAt: string | null
}

export type ActivityKind =
  | 'received'
  | 'reading'
  | 'lookup'
  | 'flagged'
  | 'filed'
  | 'rejected'
  | 'failed'
  | 'retried'
  | 'confirmed'
  | 'corrected'
  | 'dismissed'
  | 'updated'

export type Activity = Models.Row & {
  expenseId: string
  actor: 'agent' | 'user'
  kind: ActivityKind
  label: string
  detail: string | null
  durationMs: number | null
}

export type Preferences = Models.Preferences & { currency?: string }

export type User = Models.User<Preferences>
