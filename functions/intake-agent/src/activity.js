import { ID } from 'node-appwrite';
import { DATABASE_ID, TABLES, ownerPermissions } from './appwrite.js';

/**
 * One step in an expense's timeline. The owner can read and delete it. The app
 * subscribes to the activity table with Realtime, so each step appears in the
 * browser while the agent works.
 */
export function activityRow(expense, kind, label, { actor = 'agent', detail = null, durationMs = null } = {}) {
  return {
    databaseId: DATABASE_ID,
    tableId: TABLES.activity,
    rowId: ID.unique(),
    data: { expenseId: expense.$id, actor, kind, label, detail, durationMs },
    permissions: ownerPermissions(expense.ownerId, ['read', 'delete']),
  };
}

/** Returns a function that writes timeline steps for one expense. */
export function createActivityLog(tablesDB, expense) {
  return (kind, label, options) => tablesDB.createRow(activityRow(expense, kind, label, options));
}
