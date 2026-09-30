import { categoryLabel } from './categories'
import { formatDate } from './format'
import { formatMoney } from './money'
import type { Expense, ExpenseField, FieldNote, FlagField } from './types'

/** How each field is named in the UI and in the activity log ("You confirmed the total"). */
export const FIELD_LABELS: Record<FlagField, { title: string; noun: string }> = {
  merchant: { title: 'Merchant', noun: 'the merchant' },
  spentOn: { title: 'Date', noun: 'the date' },
  total: { title: 'Total', noun: 'the total' },
  tax: { title: 'Tax', noun: 'the tax' },
  currency: { title: 'Currency', noun: 'the currency' },
  category: { title: 'Category', noun: 'the category' },
  paymentMethod: { title: 'Paid with', noun: 'the payment method' },
  lineItems: { title: 'Line items', noun: 'the line items' },
  duplicate: { title: 'Possible duplicate', noun: 'the duplicate check' },
}

/** The values a person can set for each field, as stored in the expenses table. */
export type FieldValues = {
  merchant: string | null
  spentOn: string | null
  total: number | null
  tax: number | null
  currency: string | null
  category: Expense['category']
  paymentMethod: string | null
}

export const EDITABLE_FIELDS: ExpenseField[] = ['merchant', 'spentOn', 'total', 'tax', 'currency', 'category', 'paymentMethod']

export function fieldValue<F extends ExpenseField>(expense: Expense, field: F): FieldValues[F] {
  const values: FieldValues = {
    merchant: expense.merchant,
    spentOn: expense.spentOn,
    total: expense.totalMinor,
    tax: expense.taxMinor,
    currency: expense.currency,
    category: expense.category,
    paymentMethod: expense.paymentMethod,
  }
  return values[field]
}

/** The row columns to write for a new field value. */
export function fieldData(field: ExpenseField, value: FieldValues[ExpenseField]): Partial<Expense> {
  switch (field) {
    case 'total':
      return { totalMinor: value as number | null }
    case 'tax':
      return { taxMinor: value as number | null }
    default:
      return { [field]: value } as Partial<Expense>
  }
}

/** A field value as text, for the page and the activity log. */
export function displayValue(field: ExpenseField, value: FieldValues[ExpenseField], currency: string | null): string {
  if (value === null || value === '') return 'Not set'
  switch (field) {
    case 'spentOn':
      return formatDate(value as string)
    case 'total':
    case 'tax':
      return formatMoney(value as number, currency ?? 'USD')
    case 'category':
      return categoryLabel(value as NonNullable<Expense['category']>)
    default:
      return String(value)
  }
}

/** What the agent said about fields it was not sure of. */
export function parseFieldNotes(expense: Pick<Expense, 'fieldNotes'>): Partial<Record<ExpenseField, FieldNote>> {
  if (!expense.fieldNotes) return {}
  try {
    return JSON.parse(expense.fieldNotes)
  } catch {
    return {}
  }
}
