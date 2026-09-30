import { Query } from 'node-appwrite';
import { DATABASE_ID, TABLES, describeError } from './appwrite.js';
import { formatDate, fromMinor, isCurrencyCode, toMinor } from './money.js';
import { CATEGORIES, categoryLabel, isIsoDate } from './normalize.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A value the model read, how sure it is, and why when it is not sure. */
function field(type, description, extra = {}) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['value', 'confidence', 'note'],
    properties: {
      value: { type: [type, 'null'], description, ...extra },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      note: { type: ['string', 'null'], description: 'Why the confidence is medium or low' },
    },
  };
}

function tool(name, description, properties) {
  return {
    type: 'function',
    function: {
      name,
      description,
      strict: true,
      parameters: {
        type: 'object',
        additionalProperties: false,
        required: Object.keys(properties),
        properties,
      },
    },
  };
}

export const TOOLS = [
  tool(
    'find_merchant_history',
    "Look up the user's earlier expenses from a merchant, with the category they were filed under and whether the user set that category.",
    { merchant: { type: 'string', description: 'Merchant name, written the same way as in submit_expense' } },
  ),
  tool(
    'find_possible_duplicates',
    'Find expenses of this user with the same total and currency within three days of the date.',
    {
      total: { type: 'number' },
      currency: { type: 'string', description: 'ISO 4217 code' },
      date: { type: 'string', description: 'YYYY-MM-DD' },
    },
  ),
  tool('submit_expense', 'File the expense. Call this once, as the last step.', {
    merchant: field('string', 'Business name'),
    date: field('string', 'YYYY-MM-DD'),
    total: field('number', 'Amount paid, including tax and tip'),
    tax: field('number', 'Tax amount'),
    currency: field('string', 'ISO 4217 code'),
    category: field('string', 'Expense category', { enum: [...CATEGORIES, null] }),
    paymentMethod: field('string', 'For example "Visa ending 4417" or "Cash"'),
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['description', 'quantity', 'amount'],
        properties: {
          description: { type: 'string' },
          quantity: { type: ['number', 'null'] },
          amount: { type: 'number', description: 'Line amount in the document currency' },
        },
      },
    },
    duplicateOf: {
      type: ['string', 'null'],
      description: 'ID of the expense this document duplicates, from find_possible_duplicates',
    },
    summary: { type: 'string', description: 'One short sentence about the expense for the activity log' },
  }),
  tool(
    'reject_document',
    'Stop without filing, because the document is not a receipt or an invoice.',
    {
      reason: {
        type: 'string',
        description: 'One sentence for the user about what the file is, for example "This is a handwritten to-do list, not a receipt."',
      },
    },
  ),
];

export const TERMINAL_TOOLS = new Set(['submit_expense', 'reject_document']);

/**
 * Expenses of the same owner with the same total and currency within three
 * days. The owner filter comes from the upload, never from the model.
 */
export async function findDuplicateRows(tablesDB, expense, { totalMinor, currency, date }) {
  const day = Date.parse(date);
  const { rows } = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: TABLES.expenses,
    queries: [
      Query.equal('ownerId', expense.ownerId),
      Query.equal('currency', currency),
      Query.equal('totalMinor', totalMinor),
      Query.between('spentOn', new Date(day - 3 * DAY_MS).toISOString(), new Date(day + 3 * DAY_MS).toISOString()),
      // The expense being filed is still processing, so this also leaves it out.
      Query.equal('status', ['needs_review', 'ready']),
      Query.limit(5),
      Query.select(['merchant', 'spentOn', 'totalMinor', 'currency']),
    ],
  });
  return rows.map((row) => ({
    id: row.$id,
    merchant: row.merchant,
    date: row.spentOn.slice(0, 10),
    total: fromMinor(row.totalMinor, row.currency),
    currency: row.currency,
  }));
}

/**
 * The read-only lookups the model can call while it files one expense. Each
 * lookup writes a timeline step, and every query is limited to the owner.
 */
export function createLookups({ tablesDB, error }, expense, record) {
  // What the duplicate lookup showed the model, so code can check the model's answer.
  const duplicateCheck = { ran: false, matches: new Map() };

  async function findMerchantHistory({ merchant }) {
    const name = merchant.replaceAll('"', '').trim();
    if (name.length < 3) return { matches: [] };

    const { rows } = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: TABLES.expenses,
      queries: [
        // The quotes make this an exact phrase search: "Harbor Light Cafe" does not match "Blue Harbor Cafe".
        Query.search('merchant', `"${name}"`),
        Query.equal('ownerId', expense.ownerId),
        Query.equal('status', 'ready'),
        Query.orderDesc('spentOn'),
        Query.limit(5),
        Query.select(['merchant', 'category', 'correctedFields', 'spentOn', 'totalMinor', 'currency']),
      ],
    });
    const matches = rows.map((row) => ({
      merchant: row.merchant,
      category: row.category,
      categorySetBy: row.correctedFields?.includes('category') ? 'user' : 'agent',
      date: row.spentOn.slice(0, 10),
      total: fromMinor(row.totalMinor, row.currency),
      currency: row.currency,
    }));

    await record('lookup', `Looked up ${name}`, { detail: describeHistory(matches) });
    return { matches };
  }

  async function findPossibleDuplicates({ total, currency, date }) {
    if (!isCurrencyCode(currency) || !isIsoDate(date)) {
      return { error: 'Use a three-letter ISO 4217 currency code and a YYYY-MM-DD date.' };
    }
    const matches = await findDuplicateRows(tablesDB, expense, {
      totalMinor: toMinor(total, currency),
      currency,
      date,
    });
    duplicateCheck.ran = true;
    for (const match of matches) duplicateCheck.matches.set(match.id, match);

    await record('lookup', 'Checked for duplicates', { detail: describeDuplicates(matches) });
    return { matches };
  }

  /** A failed lookup becomes an error result, so the model can continue without it. */
  const safely = (name, lookup) => async (args) => {
    try {
      return await lookup(args);
    } catch (err) {
      error(`Tool ${name} failed: ${describeError(err)}`);
      return { error: 'The lookup failed. Continue without it.' };
    }
  };

  return {
    handlers: {
      find_merchant_history: safely('find_merchant_history', findMerchantHistory),
      find_possible_duplicates: safely('find_possible_duplicates', findPossibleDuplicates),
    },
    duplicateCheck,
  };
}

export function describeHistory(matches) {
  if (matches.length === 0) return 'No earlier expenses from this merchant';
  const count = `${matches.length} earlier ${matches.length === 1 ? 'expense' : 'expenses'}`;
  const chosenByUser = matches.find((match) => match.categorySetBy === 'user');
  if (chosenByUser) return `${count}. You chose ${categoryLabel(chosenByUser.category)} for this merchant.`;
  return `${count}, last filed under ${categoryLabel(matches[0].category)}`;
}

export function describeDuplicates(matches) {
  if (matches.length === 0) return 'No expense with the same total nearby';
  if (matches.length === 1) return `Same total as ${matches[0].merchant} on ${formatDate(matches[0].date)}`;
  return `${matches.length} expenses with the same total nearby`;
}
