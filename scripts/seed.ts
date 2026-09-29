/**
 * Creates two demo users and their expense history: Nora Lindqvist, the main
 * persona, and Theo Marsh, who shares some merchants and totals with Nora so
 * you can check that nobody sees another user's data. Run it again at any
 * time: it deletes and recreates the data of these two users only.
 *
 *   pnpm seed
 *
 * The files are uploaded with the API key, so the upload event carries no
 * user and the intake-agent function skips them. This script writes the rows
 * that the agent would have written.
 */
import { basename, join } from 'node:path';
import {
  AppwriteException,
  ID,
  type Models,
  Permission,
  Query,
  Role,
  Storage,
  TablesDB,
  Tokens,
  Users,
} from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import { describeDuplicates, describeHistory } from '../functions/intake-agent/src/tools.js';
import { categoryLabel } from '../functions/intake-agent/src/normalize.js';
import { BUCKET_ID, DATABASE_ID, createAdminClient, requireEnv } from './lib/appwrite.ts';
import data from './seed-data/expenses.json' with { type: 'json' };

type SeedExpense = (typeof data.expenses)[number];
type Correction = { field: string; from: string; to: string; afterMinutes: number };

const PERSONAS = {
  nora: { email: 'nora@example.com', name: 'Nora Lindqvist', currency: 'USD' },
  theo: { email: 'theo@example.com', name: 'Theo Marsh', currency: 'USD' },
} as const;

const RECEIPTS = join(import.meta.dirname, 'seed-data/receipts');
const MODEL = 'openai/gpt-6-luna';
const MIME_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', pdf: 'application/pdf' };

const password = requireEnv('SEED_PASSWORD');
if (password.length < 8) throw new Error('SEED_PASSWORD must have at least 8 characters');

const client = createAdminClient();
const tablesDB = new TablesDB(client);
const storage = new Storage(client);
const tokens = new Tokens(client);
const users = new Users(client);

/** A stable number in [0, 1) for a string, so times stay the same between runs. */
function jitter(key: string): number {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) / 4294967296;
}

const toMinor = (amount: number) => Math.round(amount * 100);
const iso = (ms: number) => new Date(ms).toISOString();

/** Receipt time in the place the receipt comes from: Lisbon for euros, Portland otherwise. */
function receiptInstant(expense: SeedExpense): number {
  const offset = expense.currency === 'EUR' ? '+01:00' : '-07:00';
  return Date.parse(`${expense.date}T${expense.time}:00${offset}`);
}

async function ensureUser(persona: (typeof PERSONAS)[keyof typeof PERSONAS]): Promise<Models.User> {
  const { users: found } = await users.list({ queries: [Query.equal('email', persona.email)] });
  const user =
    found[0] ??
    (await users.create({ userId: ID.unique(), email: persona.email, password, name: persona.name }));
  await users.updatePassword({ userId: user.$id, password });
  await users.updateName({ userId: user.$id, name: persona.name });
  await users.updateEmailVerification({ userId: user.$id, emailVerification: true });
  await users.updatePrefs({ userId: user.$id, prefs: { currency: persona.currency } });
  return user;
}

/** Deletes every expense of a user, with its line items, flags, activity, and file. */
async function deleteExpensesOf(userId: string): Promise<number> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const { rows } = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: 'expenses',
      queries: [
        Query.equal('ownerId', userId),
        Query.select(['$id']),
        Query.limit(100),
        ...(cursor ? [Query.cursorAfter(cursor)] : []),
      ],
    });
    ids.push(...rows.map((row) => row.$id));
    cursor = rows.length === 100 ? rows.at(-1)!.$id : undefined;
  } while (cursor);

  for (let start = 0; start < ids.length; start += 50) {
    const chunk = ids.slice(start, start + 50);
    for (const tableId of ['line_items', 'review_flags', 'activity']) {
      await tablesDB.deleteRows({ databaseId: DATABASE_ID, tableId, queries: [Query.equal('expenseId', chunk)] });
    }
  }
  await tablesDB.deleteRows({ databaseId: DATABASE_ID, tableId: 'expenses', queries: [Query.equal('ownerId', userId)] });
  for (const fileId of ids) {
    await storage.deleteFile({ bucketId: BUCKET_ID, fileId }).catch((err) => {
      if (!(err instanceof AppwriteException && err.code === 404)) throw err;
    });
  }
  return ids.length;
}

type Filed = { expense: SeedExpense; id: string; correctedAt: number | null };

async function seedExpense(expense: SeedExpense, userId: string, earlier: Filed[]): Promise<Filed> {
  const owner = Role.user(userId);
  const fileName = basename(expense.file);
  const extension = fileName.split('.').pop()!;

  const file = await storage.createFile({
    bucketId: BUCKET_ID,
    fileId: ID.unique(),
    file: InputFile.fromPath(join(RECEIPTS, expense.file), fileName),
    permissions: [Permission.read(owner), Permission.update(owner), Permission.delete(owner)],
  });
  const viewToken = await tokens.createFileToken({ bucketId: BUCKET_ID, fileId: file.$id });

  // Invoices arrive by email and get uploaded hours later; paper receipts within minutes.
  const delayMinutes = expense.template === 'thermal' ? 3 + jitter(fileName) * 27 : 120 + jitter(fileName) * 420;
  const uploadedAt = receiptInstant(expense) + delayMinutes * 60_000;
  const filedAt = uploadedAt + expense.filedInMs;
  const corrections = expense.corrections as Correction[];
  const correctedAt = corrections.length ? filedAt + corrections[0].afterMinutes * 60_000 : null;
  const noteAt = expense.note ? filedAt + 26 * 60_000 : null;
  const lastChange = Math.max(filedAt, correctedAt ?? 0, noteAt ?? 0);

  const taxMinor = expense.tax ? toMinor(expense.tax.amount) : null;
  await tablesDB.createRow({
    databaseId: DATABASE_ID,
    tableId: 'expenses',
    rowId: file.$id,
    data: {
      $createdAt: iso(uploadedAt),
      $updatedAt: iso(lastChange),
      ownerId: userId,
      status: 'ready',
      fileName,
      mimeType: MIME_TYPES[extension],
      sizeBytes: file.sizeOriginal,
      viewToken: viewToken.secret,
      merchant: expense.merchant,
      spentOn: `${expense.date}T00:00:00.000+00:00`,
      totalMinor: toMinor(expense.total),
      taxMinor,
      currency: expense.currency,
      category: expense.category,
      paymentMethod: expense.paymentMethod,
      note: expense.note,
      agentSummary: expense.summary,
      correctedFields: corrections.map((correction) => correction.field),
      openFlags: 0,
      model: MODEL,
      filedInMs: expense.filedInMs,
    },
    permissions: [Permission.read(owner), Permission.update(owner), Permission.delete(owner)],
  });

  const lineItems = [...expense.items];
  if (expense.tip) lineItems.push({ description: 'Tip', quantity: 1, amount: expense.tip });
  await tablesDB.createRows({
    databaseId: DATABASE_ID,
    tableId: 'line_items',
    rows: lineItems.map((item, position) => ({
      $id: ID.unique(),
      $createdAt: iso(filedAt),
      $permissions: [Permission.read(owner), Permission.delete(owner)],
      expenseId: file.$id,
      position,
      description: item.description,
      quantity: item.quantity,
      amountMinor: toMinor(item.amount),
    })),
  });

  // The same lookups the agent runs, answered from this user's earlier seeded expenses.
  const history = earlier
    .filter((filed) => filed.expense.merchant === expense.merchant)
    .reverse()
    .slice(0, 5)
    .map((filed) => ({
      category: filed.expense.category,
      categorySetBy: filed.correctedAt !== null && filed.correctedAt < uploadedAt ? 'user' : 'agent',
    }));
  const day = 24 * 60 * 60 * 1000;
  const duplicates = earlier
    .filter(
      (filed) =>
        filed.expense.currency === expense.currency &&
        filed.expense.total === expense.total &&
        Math.abs(Date.parse(filed.expense.date) - Date.parse(expense.date)) <= 3 * day,
    )
    .map((filed) => ({ merchant: filed.expense.merchant, date: filed.expense.date }));

  const step = (at: number, actor: 'agent' | 'user', kind: string, label: string, detail: string | null = null, durationMs: number | null = null) => ({
    $id: ID.unique(),
    $createdAt: iso(at),
    $permissions: [Permission.read(owner), Permission.delete(owner)],
    expenseId: file.$id,
    actor,
    kind,
    label,
    detail,
    durationMs,
  });
  const steps = [
    step(uploadedAt + 900, 'agent', 'received', `Received ${fileName}`),
    step(uploadedAt + 2_300, 'agent', 'reading', 'Reading the receipt'),
    step(uploadedAt + 5_600, 'agent', 'lookup', `Looked up ${expense.merchant}`, describeHistory(history)),
    step(uploadedAt + 6_400, 'agent', 'lookup', 'Checked for duplicates', describeDuplicates(duplicates)),
    step(filedAt, 'agent', 'filed', `Filed under ${categoryLabel(corrections[0]?.from ?? expense.category)}`, expense.summary, expense.filedInMs),
  ];
  for (const correction of corrections) {
    steps.push(
      step(correctedAt!, 'user', 'corrected', `You changed the ${correction.field} from ${categoryLabel(correction.from)} to ${categoryLabel(correction.to)}`),
    );
  }
  if (expense.note) steps.push(step(noteAt!, 'user', 'updated', 'You added a note', expense.note));
  await tablesDB.createRows({ databaseId: DATABASE_ID, tableId: 'activity', rows: steps });

  return { expense, id: file.$id, correctedAt };
}

for (const [key, persona] of Object.entries(PERSONAS)) {
  const user = await ensureUser(persona);
  const removed = await deleteExpensesOf(user.$id);
  const filed: Filed[] = [];
  for (const expense of data.expenses.filter((expense) => expense.owner === key)) {
    filed.push(await seedExpense(expense, user.$id, filed));
  }
  console.log(`${persona.name} (${persona.email}): removed ${removed}, seeded ${filed.length} expenses`);
}
