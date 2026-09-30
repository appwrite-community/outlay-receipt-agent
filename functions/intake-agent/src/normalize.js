import { isCurrencyCode, toMinor } from './money.js';

export const CATEGORIES = [
  'meals', 'travel', 'lodging', 'transport', 'software', 'equipment', 'office', 'fees', 'other',
];

export const categoryLabel = (category) => category[0].toUpperCase() + category.slice(1);

const MAX_LINE_ITEMS = 30;

// Model field names and the review flag field each one maps to.
export const REVIEWED_FIELDS = {
  merchant: 'merchant',
  date: 'spentOn',
  total: 'total',
  tax: 'tax',
  currency: 'currency',
  category: 'category',
  paymentMethod: 'paymentMethod',
};

export function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const clip = (text, size) => (typeof text === 'string' ? text.trim().slice(0, size) || null : null);

const isObject = (value) => typeof value === 'object' && value !== null;

/** True when the arguments have the shape of the submit_expense schema. */
export function isSubmission(args) {
  return (
    Object.keys(REVIEWED_FIELDS).every((name) => isObject(args[name]) && 'value' in args[name] && 'confidence' in args[name]) &&
    Array.isArray(args.lineItems) &&
    args.lineItems.every(isObject) &&
    typeof args.summary === 'string'
  );
}

/**
 * Turns the model's submit_expense arguments into row values: money in minor
 * units, the date at UTC midnight, text cut to the column sizes. Values that
 * cannot be used become issues, which the review policy turns into flags.
 */
export function normalizeSubmission(submission, { homeCurrency }) {
  const issues = [];
  const readCurrency = submission.currency.value?.trim().toUpperCase();
  let currency = readCurrency;
  if (!isCurrencyCode(readCurrency)) {
    currency = homeCurrency;
    issues.push({
      field: 'currency',
      reason: readCurrency
        ? `"${readCurrency}" is not a currency code. The agent used your home currency.`
        : 'No currency found. The agent used your home currency.',
    });
  }

  const date = submission.date.value;
  if (date !== null && !isIsoDate(date)) {
    issues.push({ field: 'spentOn', reason: `"${date}" is not a valid date.` });
  }

  const amount = (value) => (Number.isFinite(value) ? toMinor(value, currency) : null);
  const lineItems = submission.lineItems.slice(0, MAX_LINE_ITEMS).map((item, position) => ({
    position,
    description: clip(item.description, 256) ?? 'Item',
    quantity: Number.isFinite(item.quantity) ? item.quantity : null,
    amountMinor: amount(item.amount) ?? 0,
  }));
  if (submission.lineItems.length > MAX_LINE_ITEMS) {
    issues.push({ field: 'lineItems', reason: `Only the first ${MAX_LINE_ITEMS} line items were saved.` });
  }

  return {
    data: {
      merchant: clip(submission.merchant.value, 128),
      spentOn: isIsoDate(date) ? `${date}T00:00:00.000+00:00` : null,
      totalMinor: amount(submission.total.value),
      taxMinor: amount(submission.tax.value),
      currency,
      category: CATEGORIES.includes(submission.category.value) ? submission.category.value : null,
      paymentMethod: clip(submission.paymentMethod.value, 64),
      agentSummary: clip(submission.summary, 280),
      fieldNotes: fieldNotes(submission),
    },
    lineItems,
    issues,
  };
}

/** Confidence and notes for every value the model was not sure about, as JSON. */
function fieldNotes(submission) {
  const notes = {};
  for (const [name, field] of Object.entries(REVIEWED_FIELDS)) {
    const { value, confidence, note } = submission[name];
    if (value !== null && confidence !== 'high') notes[field] = { confidence, note: clip(note, 280) };
  }
  return Object.keys(notes).length ? JSON.stringify(notes) : null;
}
