import { categoryLabel, isCategory } from './categories'
import { formatDate, fromDateInput, toDateInput } from './format'
import { formatMoney, fractionDigits, fromMinor, isCurrencyCode, parseAmount, toMinor } from './money'
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

export type Provenance = { kind: 'read' | 'inferred' | 'changed'; label: string; note: string | null }

/** Where a value came from: printed on the receipt, inferred by the agent, or changed by you. */
export function provenance(expense: Expense, field: ExpenseField): Provenance {
  if (expense.correctedFields.includes(field)) return { kind: 'changed', label: 'Changed by you', note: null }
  const note = parseFieldNotes(expense)[field]
  if (note) return { kind: 'inferred', label: 'Inferred by the agent', note: note.note }
  return { kind: 'read', label: 'Read by the agent', note: null }
}

/** Form text for each field while a person edits it. */
export type Draft = Record<ExpenseField, string>

export function toDraft(expense: Expense): Draft {
  const amount = (minor: number | null) =>
    minor === null || !expense.currency ? '' : fromMinor(minor, expense.currency).toFixed(fractionDigits(expense.currency))
  return {
    merchant: expense.merchant ?? '',
    spentOn: expense.spentOn ? toDateInput(expense.spentOn) : '',
    total: amount(expense.totalMinor),
    tax: amount(expense.taxMinor),
    currency: expense.currency ?? '',
    category: expense.category ?? '',
    paymentMethod: expense.paymentMethod ?? '',
  }
}

export type Parsed = { value: FieldValues[ExpenseField]; error?: never } | { value?: never; error: string }

/** Turns form text into a stored value, or explains what is wrong with it. */
export function parseField(field: ExpenseField, text: string, currency: string | null): Parsed {
  const trimmed = text.trim()
  const ok = (value: FieldValues[ExpenseField]) => ({ value })
  switch (field) {
    case 'merchant':
      return trimmed ? ok(trimmed) : { error: 'Enter the merchant name.' }
    case 'spentOn':
      return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? ok(fromDateInput(trimmed)) : { error: 'Choose the date on the receipt.' }
    case 'total':
    case 'tax': {
      if (!trimmed) return field === 'tax' ? ok(null) : { error: 'Enter the total.' }
      const amount = parseAmount(trimmed)
      if (amount === null) return { error: 'Enter an amount like 44.50.' }
      if (!currency || !isCurrencyCode(currency)) return { error: 'Set the currency first.' }
      return ok(toMinor(amount, currency))
    }
    case 'currency': {
      const code = trimmed.toUpperCase()
      return isCurrencyCode(code) ? ok(code) : { error: 'Enter a three-letter code like USD.' }
    }
    case 'category':
      return isCategory(trimmed) ? ok(trimmed) : { error: 'Choose a category.' }
    case 'paymentMethod':
      return ok(trimmed || null)
  }
}
