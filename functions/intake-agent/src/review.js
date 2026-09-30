import { formatDate, formatMoney, fromMinor, fractionDigits } from './money.js';
import { REVIEWED_FIELDS } from './normalize.js';

// A guess on these fields changes how much money was spent, or when.
const REVIEW_WHEN_INFERRED = new Set(['total', 'date', 'currency']);
// Many receipts show no tax or payment method. That is not a problem.
const OPTIONAL = new Set(['tax', 'paymentMethod']);
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Decides which fields a person has to check. The model reports how sure it
 * is, and code adds checks that do not depend on the model at all. Returns at
 * most one flag per field.
 */
export function reviewFlags({ submission, data, lineItems, issues, duplicate, today }) {
  const flags = new Map();
  const flag = (field, source, reason, relatedExpenseId = null) => {
    const existing = flags.get(field);
    flags.set(field, {
      field,
      source: existing?.source === 'check' ? 'check' : source,
      reason: (existing ? `${existing.reason} ${reason}` : reason).slice(0, 280),
      agentValue: agentValue(field, data),
      relatedExpenseId,
    });
  };

  // What the model itself was unsure about.
  for (const [name, field] of Object.entries(REVIEWED_FIELDS)) {
    const { value, confidence, note } = submission[name];
    if (value === null && OPTIONAL.has(name)) continue;
    if (confidence === 'low' || (confidence === 'medium' && REVIEW_WHEN_INFERRED.has(name))) {
      flag(field, 'model', note ?? 'The agent was not sure about this value.');
    }
  }

  // Values that could not be used as they were.
  for (const issue of issues) flag(issue.field, 'check', issue.reason);

  // Checks on the values themselves.
  const { merchant, totalMinor, taxMinor, currency, spentOn, category } = data;
  if (!merchant) flag('merchant', 'check', 'No merchant found.');
  if (totalMinor === null) flag('total', 'check', 'No total found.');
  else if (totalMinor <= 0) flag('total', 'check', 'The total is not a positive amount.');

  if (spentOn) {
    const age = Date.parse(today) - Date.parse(spentOn);
    if (age < -DAY_MS) flag('spentOn', 'check', 'The date is in the future.');
    if (age > 365 * DAY_MS) flag('spentOn', 'check', 'The date is more than a year ago.');
  } else if (!flags.has('spentOn')) {
    flag('spentOn', 'check', 'No date found.');
  }

  if (!category) flag('category', 'check', 'No category was chosen.');

  if (lineItems.length > 0 && totalMinor !== null) {
    const sum = lineItems.reduce((total, item) => total + item.amountMinor, 0);
    const matchesTotal = (amount) => Math.abs(amount - totalMinor) <= 1;
    if (!matchesTotal(sum) && !matchesTotal(sum + (taxMinor ?? 0))) {
      flag(
        'lineItems',
        'check',
        `Line items add up to ${formatMoney(sum, currency)}, the total is ${formatMoney(totalMinor, currency)}.`,
      );
    }
  }

  if (duplicate) {
    flag(
      'duplicate',
      'check',
      `${duplicate.merchant} on ${formatDate(duplicate.date)} has the same total.`,
      duplicate.id,
    );
  }

  return [...flags.values()];
}

/** The agent's value for a flagged field, as text for the review screen. */
function agentValue(field, data) {
  const value = {
    merchant: data.merchant,
    spentOn: data.spentOn?.slice(0, 10),
    total: money(data.totalMinor, data.currency),
    tax: money(data.taxMinor, data.currency),
    currency: data.currency,
    category: data.category,
    paymentMethod: data.paymentMethod,
  }[field];
  return value ? String(value).slice(0, 128) : null;
}

const money = (minor, currency) =>
  minor === null ? null : fromMinor(minor, currency).toFixed(fractionDigits(currency));
