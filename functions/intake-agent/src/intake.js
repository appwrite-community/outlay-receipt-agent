import { AppwriteException, ID, Query } from 'node-appwrite';
import { APIConnectionError, APIError } from 'openai';
import { FilingError, modelId, runAgent } from './agent.js';
import { activityRow, createActivityLog } from './activity.js';
import { BUCKET_ID, DATABASE_ID, TABLES, describeError, ownerPermissions } from './appwrite.js';
import { isCurrencyCode } from './money.js';
import { categoryLabel, normalizeSubmission } from './normalize.js';
import { reviewFlags } from './review.js';
import { createLookups, findDuplicateRows } from './tools.js';

const MODEL_TOKEN_LIFETIME_MS = 15 * 60 * 1000;
// Longer than the function timeout, so a run in this state has stopped.
const STUCK_AFTER_MS = 4 * 60 * 1000;

const isAppwriteError = (err, code) => err instanceof AppwriteException && err.code === code;

/** Event path: a file finished uploading to the receipts bucket. */
export async function handleUpload(ctx, file, ownerId) {
  // The SDK uploads large files in 5 MB chunks. Only a complete file is a receipt.
  if (file.chunksUploaded !== file.chunksTotal) return;

  // Files uploaded with an API key, such as the seed data, have no user.
  if (!ownerId) {
    ctx.log(`Skipped ${file.$id}: uploaded with an API key`);
    return;
  }

  const expense = await claimUpload(ctx, file, ownerId);
  if (!expense) {
    ctx.log(`Skipped ${file.$id}: another execution already claimed it`);
    return;
  }

  await createActivityLog(ctx.tablesDB, expense)('received', `Received ${file.name}`);
  const status = await fileExpense(ctx, expense);
  ctx.log(`${expense.$id}: ${status}`);
}

/**
 * The expense row uses the file ID as its row ID, so creating it also claims
 * the upload: when the same event runs twice, the second create fails with 409.
 */
async function claimUpload({ tablesDB }, file, ownerId) {
  try {
    return await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.expenses,
      rowId: file.$id,
      data: {
        ownerId,
        status: 'processing',
        fileName: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.sizeOriginal,
      },
      permissions: ownerPermissions(ownerId),
    });
  } catch (err) {
    if (isAppwriteError(err, 409)) return null;
    throw err;
  }
}

/** A link to one private file. It works without a session until the token expires or is deleted. */
function fileUrl(fileId, secret) {
  if (!process.env.APPWRITE_PUBLIC_ENDPOINT) {
    throw new FilingError('The intake-agent function has no APPWRITE_PUBLIC_ENDPOINT variable.');
  }
  const url = new URL(`${process.env.APPWRITE_PUBLIC_ENDPOINT}/storage/buckets/${BUCKET_ID}/files/${fileId}/view`);
  url.searchParams.set('project', process.env.APPWRITE_FUNCTION_PROJECT_ID);
  url.searchParams.set('token', secret);
  return url.toString();
}

/** Reads the receipt with the model and saves the result. Returns the final status. */
async function fileExpense(ctx, expense) {
  const { tablesDB, tokens, users } = ctx;
  const startedAt = Date.now();
  const record = createActivityLog(tablesDB, expense);
  let modelToken = null;

  try {
    if (!expense.viewToken) {
      // The app shows the receipt with this token. It has no expiry and opens this file only.
      const viewToken = await tokens.createFileToken({ bucketId: BUCKET_ID, fileId: expense.$id });
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: TABLES.expenses,
        rowId: expense.$id,
        data: { viewToken: viewToken.secret },
      });
    }

    const prefs = await users.getPrefs({ userId: expense.ownerId });
    const homeCurrency = isCurrencyCode(prefs.currency) ? prefs.currency : 'USD';

    // The model provider downloads the file from this link on every model call,
    // so the token has to outlive the whole loop. It is deleted in `finally`.
    modelToken = await tokens.createFileToken({
      bucketId: BUCKET_ID,
      fileId: expense.$id,
      expire: new Date(Date.now() + MODEL_TOKEN_LIFETIME_MS).toISOString(),
    });
    await record('reading', 'Reading the receipt');

    const lookups = createLookups(ctx, expense, record);
    const today = new Date().toISOString().slice(0, 10);
    const outcome = await runAgent({
      document: { name: expense.fileName, mimeType: expense.mimeType, url: fileUrl(expense.$id, modelToken.secret) },
      homeCurrency,
      today,
      lookups: lookups.handlers,
    });

    if (outcome.tool === 'reject_document') {
      return await saveRejection(ctx, expense, outcome.args.reason);
    }

    const submission = outcome.args;
    const { data, lineItems, issues } = normalizeSubmission(submission, { homeCurrency });
    const duplicate = await pickDuplicate(ctx, expense, submission, data, lookups.duplicateCheck);
    const flags = reviewFlags({ submission, data, lineItems, issues, duplicate, today });

    return await saveExpense(ctx, expense, {
      data: { ...data, duplicateOf: duplicate?.id ?? null, model: modelId(), filedInMs: Date.now() - startedAt },
      lineItems,
      flags,
    });
  } catch (err) {
    return await markFailed(ctx, expense, err);
  } finally {
    if (modelToken) {
      await tokens.delete({ tokenId: modelToken.$id }).catch((err) => {
        ctx.error(`Could not delete the model token of ${expense.$id}: ${describeError(err)}`);
      });
    }
  }
}

/**
 * The model may point at a duplicate, but only one that the lookup returned in
 * this run. If the model never ran the lookup, code runs the same query and
 * applies the rule from the prompt: same merchant, same date.
 */
export async function pickDuplicate({ tablesDB }, expense, submission, data, duplicateCheck) {
  if (duplicateCheck.matches.has(submission.duplicateOf)) return duplicateCheck.matches.get(submission.duplicateOf);
  if (duplicateCheck.ran || data.totalMinor === null || !data.spentOn || !data.merchant) return null;

  const date = data.spentOn.slice(0, 10);
  const matches = await findDuplicateRows(tablesDB, expense, { totalMinor: data.totalMinor, currency: data.currency, date });
  const sameReceipt = (match) => match.date === date && match.merchant?.toLowerCase() === data.merchant.toLowerCase();
  return matches.find(sameReceipt) ?? null;
}

const FIELD_NAMES = {
  merchant: 'the merchant',
  spentOn: 'the date',
  total: 'the total',
  tax: 'the tax',
  currency: 'the currency',
  category: 'the category',
  paymentMethod: 'the payment method',
  lineItems: 'the line items',
  duplicate: 'a possible duplicate',
};

function listFields(flags) {
  const names = flags.map((flag) => FIELD_NAMES[flag.field]);
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];
}

/**
 * Saves the expense, its line items, its review flags, and the last timeline
 * step in one transaction, so the app never sees half a result.
 */
async function saveExpense({ tablesDB }, expense, { data, lineItems, flags }) {
  const status = flags.length > 0 ? 'needs_review' : 'ready';
  const owner = expense.ownerId;
  const { $id: transactionId } = await tablesDB.createTransaction({ ttl: 60 });

  try {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.expenses,
      rowId: expense.$id,
      data: { ...data, status, openFlags: flags.length, failureReason: null },
      transactionId,
    });

    // A retry replaces whatever an earlier run saved.
    for (const tableId of [TABLES.lineItems, TABLES.flags]) {
      await tablesDB.deleteRows({
        databaseId: DATABASE_ID,
        tableId,
        queries: [Query.equal('expenseId', expense.$id)],
        transactionId,
      });
    }
    if (lineItems.length > 0) {
      await tablesDB.createRows({
        databaseId: DATABASE_ID,
        tableId: TABLES.lineItems,
        rows: lineItems.map((item) => ({
          $id: ID.unique(),
          $permissions: ownerPermissions(owner, ['read', 'delete']),
          expenseId: expense.$id,
          ...item,
        })),
        transactionId,
      });
    }
    if (flags.length > 0) {
      await tablesDB.createRows({
        databaseId: DATABASE_ID,
        tableId: TABLES.flags,
        rows: flags.map((flag) => ({
          $id: ID.unique(),
          $permissions: ownerPermissions(owner),
          expenseId: expense.$id,
          status: 'open',
          ...flag,
        })),
        transactionId,
      });
    }

    const step =
      status === 'ready'
        ? activityRow(expense, 'filed', `Filed under ${categoryLabel(data.category)}`, { detail: data.agentSummary, durationMs: data.filedInMs })
        : activityRow(expense, 'flagged', `Sent ${flags.length} ${flags.length === 1 ? 'field' : 'fields'} to review`, {
            detail: `Check ${listFields(flags)}.`,
            durationMs: data.filedInMs,
          });
    await tablesDB.createRow({ ...step, transactionId });

    await tablesDB.updateTransaction({ transactionId, commit: true });
    return status;
  } catch (err) {
    await tablesDB.updateTransaction({ transactionId, rollback: true }).catch(() => {});
    throw err;
  }
}

async function saveRejection({ tablesDB }, expense, reason) {
  const text = reason.trim().slice(0, 500);
  await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.expenses,
    rowId: expense.$id,
    data: { status: 'rejected', failureReason: text, model: modelId(), openFlags: 0 },
  });
  await createActivityLog(tablesDB, expense)('rejected', 'Not a receipt', { detail: text });
  return 'rejected';
}

/** The message the app shows for a failed run. Details stay in the function logs. */
function failureReason(err) {
  if (err instanceof FilingError) return err.message;
  if (err instanceof APIConnectionError) return 'The model provider did not answer. Retry in a moment.';
  if (err instanceof APIError) {
    if (err.status === 429 || err.status >= 500) return 'The model provider did not answer. Retry in a moment.';
    return 'The model provider rejected the request. Check the function logs.';
  }
  if (isAppwriteError(err, 409) && err.type === 'transaction_conflict') {
    return 'The expense changed while the agent was working. Retry to file it again.';
  }
  return 'Something went wrong while filing this receipt. Retry to try again.';
}

async function markFailed(ctx, expense, err) {
  const { tablesDB } = ctx;
  let current;
  try {
    current = await tablesDB.getRow({ databaseId: DATABASE_ID, tableId: TABLES.expenses, rowId: expense.$id });
  } catch (readErr) {
    if (!isAppwriteError(readErr, 404)) throw readErr;
    ctx.log(`Stopped ${expense.$id}: the expense was deleted while the agent worked`);
    return 'deleted';
  }
  // Another run saved this expense first.
  if (current.status !== 'processing') return current.status;

  ctx.error(`Filing ${expense.$id} failed: ${describeError(err)}`);
  const reason = failureReason(err);
  await tablesDB.updateRow({
    databaseId: DATABASE_ID,
    tableId: TABLES.expenses,
    rowId: expense.$id,
    data: { status: 'failed', failureReason: reason },
  });
  await createActivityLog(tablesDB, expense)('failed', 'Could not file this receipt', { detail: reason });
  return 'failed';
}

class RetryRefused extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function canRetry(expense) {
  if (expense.status === 'failed' || expense.status === 'rejected') return true;
  return expense.status === 'processing' && Date.now() - Date.parse(expense.$updatedAt) > STUCK_AFTER_MS;
}

/**
 * Moves an expense back to processing for a retry. The update is staged
 * before the row is read, so two retries at the same time cannot both win:
 * the later one either reads "processing" or its commit fails with a conflict.
 * `$updatedAt` is set explicitly because a run that stopped answering is
 * already "processing", and an update that changes no value keeps the old
 * timestamp: the claim must always count as a change.
 */
async function claimRetry({ tablesDB }, expenseId, callerId) {
  const { $id: transactionId } = await tablesDB.createTransaction({ ttl: 60 });
  try {
    await tablesDB.updateRow({
      databaseId: DATABASE_ID,
      tableId: TABLES.expenses,
      rowId: expenseId,
      data: { status: 'processing', failureReason: null, $updatedAt: new Date().toISOString() },
      transactionId,
    });
    const expense = await tablesDB.getRow({ databaseId: DATABASE_ID, tableId: TABLES.expenses, rowId: expenseId });
    if (expense.ownerId !== callerId) throw new RetryRefused(404, 'Expense not found.');
    if (!canRetry(expense)) throw new RetryRefused(409, 'This expense cannot be retried now.');

    await tablesDB.createRow({
      ...activityRow(expense, 'retried', 'You asked the agent to try again', { actor: 'user' }),
      transactionId,
    });
    await tablesDB.updateTransaction({ transactionId, commit: true });
    return { ...expense, status: 'processing' };
  } catch (err) {
    await tablesDB.updateTransaction({ transactionId, rollback: true }).catch(() => {});
    if (isAppwriteError(err, 404)) throw new RetryRefused(404, 'Expense not found.');
    if (isAppwriteError(err, 409)) throw new RetryRefused(409, 'This expense cannot be retried now.');
    throw err;
  }
}

/** HTTP path: the owner of a failed or rejected expense asks the agent to try again. */
export async function handleRetry(ctx, body, callerId) {
  if (!callerId) return { status: 401, body: { message: 'Sign in to retry.' } };
  if (typeof body?.expenseId !== 'string') return { status: 400, body: { message: 'Send { "expenseId": "..." }.' } };

  let expense;
  try {
    expense = await claimRetry(ctx, body.expenseId, callerId);
  } catch (err) {
    if (err instanceof RetryRefused) return { status: err.status, body: { message: err.message } };
    throw err;
  }

  const status = await fileExpense(ctx, expense);
  ctx.log(`${expense.$id}: ${status} after a retry`);
  return { status: 200, body: { expenseId: expense.$id, status } };
}
