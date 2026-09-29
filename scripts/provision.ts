/**
 * Creates the Outlay database, tables, columns, indexes, and the receipts bucket.
 * Safe to run again: anything that already exists is skipped.
 *
 *   pnpm provision
 */
import {
  AppwriteException,
  Compression,
  Permission,
  Role,
  Storage,
  TablesDB,
  TablesDBIndexType,
} from 'node-appwrite';
import { BUCKET_ID, DATABASE_ID, createAdminClient } from './lib/appwrite.ts';

const client = createAdminClient();
const tablesDB = new TablesDB(client);
const storage = new Storage(client);

const CATEGORIES = ['meals', 'travel', 'lodging', 'transport', 'software', 'equipment', 'office', 'fees', 'other'];
const FLAG_FIELDS = ['merchant', 'spentOn', 'total', 'tax', 'currency', 'category', 'paymentMethod', 'lineItems', 'duplicate'];
const ACTIVITY_KINDS = [
  'received', 'reading', 'lookup', 'flagged', 'filed', 'rejected', 'failed',
  'retried', 'confirmed', 'corrected', 'dismissed', 'updated',
];

type Column =
  | { type: 'varchar'; key: string; size: number; required?: boolean; array?: boolean }
  | { type: 'text'; key: string; required?: boolean }
  | { type: 'integer'; key: string; required?: boolean; min?: number; xdefault?: number }
  | { type: 'float'; key: string; required?: boolean }
  | { type: 'datetime'; key: string; required?: boolean }
  | { type: 'enum'; key: string; elements: string[]; required?: boolean; xdefault?: string };

type Index = { key: string; type: TablesDBIndexType; columns: string[] };

type Table = {
  tableId: string;
  name: string;
  permissions: string[];
  columns: Column[];
  indexes: Index[];
};

const TABLES: Table[] = [
  {
    tableId: 'expenses',
    name: 'Expenses',
    permissions: [],
    columns: [
      { type: 'varchar', key: 'ownerId', size: 36, required: true },
      { type: 'enum', key: 'status', elements: ['processing', 'needs_review', 'ready', 'failed', 'rejected'], required: true },
      { type: 'varchar', key: 'fileName', size: 255, required: true },
      { type: 'varchar', key: 'mimeType', size: 100, required: true },
      { type: 'integer', key: 'sizeBytes', min: 0 },
      { type: 'varchar', key: 'viewToken', size: 512 },
      { type: 'varchar', key: 'merchant', size: 128 },
      { type: 'datetime', key: 'spentOn' },
      { type: 'integer', key: 'totalMinor' },
      { type: 'integer', key: 'taxMinor' },
      { type: 'varchar', key: 'currency', size: 3 },
      { type: 'enum', key: 'category', elements: CATEGORIES },
      { type: 'varchar', key: 'paymentMethod', size: 64 },
      { type: 'varchar', key: 'note', size: 500 },
      { type: 'varchar', key: 'agentSummary', size: 280 },
      { type: 'text', key: 'fieldNotes' },
      { type: 'varchar', key: 'correctedFields', size: 32, array: true },
      { type: 'integer', key: 'openFlags', min: 0, xdefault: 0 },
      { type: 'varchar', key: 'duplicateOf', size: 36 },
      { type: 'varchar', key: 'failureReason', size: 500 },
      { type: 'varchar', key: 'model', size: 64 },
      { type: 'integer', key: 'filedInMs', min: 0 },
      { type: 'datetime', key: 'reviewedAt' },
    ],
    indexes: [
      { key: 'owner_spent', type: TablesDBIndexType.Key, columns: ['ownerId', 'spentOn'] },
      { key: 'status_spent', type: TablesDBIndexType.Key, columns: ['status', 'spentOn'] },
      { key: 'owner_total', type: TablesDBIndexType.Key, columns: ['ownerId', 'totalMinor'] },
      { key: 'category_spent', type: TablesDBIndexType.Key, columns: ['category', 'spentOn'] },
      { key: 'merchant_search', type: TablesDBIndexType.Fulltext, columns: ['merchant'] },
    ],
  },
  {
    tableId: 'line_items',
    name: 'Line items',
    permissions: [],
    columns: [
      { type: 'varchar', key: 'expenseId', size: 36, required: true },
      { type: 'integer', key: 'position', required: true, min: 0 },
      { type: 'varchar', key: 'description', size: 256, required: true },
      { type: 'float', key: 'quantity' },
      { type: 'integer', key: 'amountMinor', required: true },
    ],
    indexes: [{ key: 'by_expense', type: TablesDBIndexType.Key, columns: ['expenseId', 'position'] }],
  },
  {
    tableId: 'review_flags',
    name: 'Review flags',
    permissions: [],
    columns: [
      { type: 'varchar', key: 'expenseId', size: 36, required: true },
      { type: 'enum', key: 'field', elements: FLAG_FIELDS, required: true },
      { type: 'enum', key: 'source', elements: ['model', 'check'], required: true },
      { type: 'varchar', key: 'reason', size: 280, required: true },
      { type: 'varchar', key: 'agentValue', size: 128 },
      { type: 'varchar', key: 'relatedExpenseId', size: 36 },
      { type: 'enum', key: 'status', elements: ['open', 'resolved'], xdefault: 'open' },
      { type: 'enum', key: 'resolution', elements: ['confirmed', 'corrected', 'dismissed'] },
      { type: 'datetime', key: 'resolvedAt' },
    ],
    indexes: [{ key: 'by_expense', type: TablesDBIndexType.Key, columns: ['expenseId'] }],
  },
  {
    tableId: 'activity',
    name: 'Activity',
    // Signed-in users can add their own steps ("You confirmed the total") to the timeline.
    permissions: [Permission.create(Role.users())],
    columns: [
      { type: 'varchar', key: 'expenseId', size: 36, required: true },
      { type: 'enum', key: 'actor', elements: ['agent', 'user'], required: true },
      { type: 'enum', key: 'kind', elements: ACTIVITY_KINDS, required: true },
      { type: 'varchar', key: 'label', size: 200, required: true },
      { type: 'varchar', key: 'detail', size: 500 },
      { type: 'integer', key: 'durationMs', min: 0 },
    ],
    indexes: [{ key: 'by_expense', type: TablesDBIndexType.Key, columns: ['expenseId'] }],
  },
];

/** Runs a create call and treats "already exists" (409) as done. */
async function ensure(label: string, create: () => Promise<unknown>): Promise<void> {
  try {
    await create();
    console.log(`created  ${label}`);
  } catch (err) {
    if (err instanceof AppwriteException && err.code === 409) {
      console.log(`exists   ${label}`);
      return;
    }
    throw err;
  }
}

function createColumn(tableId: string, column: Column): Promise<unknown> {
  const base = { databaseId: DATABASE_ID, tableId, key: column.key, required: column.required ?? false };
  switch (column.type) {
    case 'varchar':
      return tablesDB.createVarcharColumn({ ...base, size: column.size, array: column.array });
    case 'text':
      return tablesDB.createTextColumn(base);
    case 'integer':
      return tablesDB.createIntegerColumn({ ...base, min: column.min, xdefault: column.xdefault });
    case 'float':
      return tablesDB.createFloatColumn(base);
    case 'datetime':
      return tablesDB.createDatetimeColumn(base);
    case 'enum':
      return tablesDB.createEnumColumn({ ...base, elements: column.elements, xdefault: column.xdefault });
  }
}

/** Columns are created in the background. Indexes need them to be available first. */
async function waitForColumns(tableId: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const { columns } = await tablesDB.listColumns({ databaseId: DATABASE_ID, tableId });
    const failed = columns.find((column) => column.status === 'failed');
    if (failed) throw new Error(`Column ${tableId}.${failed.key} failed: ${failed.error}`);
    if (columns.every((column) => column.status === 'available')) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Columns of ${tableId} are still processing`);
}

await ensure(`database ${DATABASE_ID}`, () => tablesDB.create({ databaseId: DATABASE_ID, name: 'Outlay' }));

for (const table of TABLES) {
  await ensure(`table ${table.tableId}`, () =>
    tablesDB.createTable({
      databaseId: DATABASE_ID,
      tableId: table.tableId,
      name: table.name,
      permissions: table.permissions,
      rowSecurity: true,
    }),
  );
  for (const column of table.columns) {
    await ensure(`column ${table.tableId}.${column.key}`, () => createColumn(table.tableId, column));
  }
  await waitForColumns(table.tableId);
  for (const index of table.indexes) {
    await ensure(`index ${table.tableId}.${index.key}`, () =>
      tablesDB.createIndex({ databaseId: DATABASE_ID, tableId: table.tableId, ...index }),
    );
  }
}

await ensure(`bucket ${BUCKET_ID}`, () =>
  storage.createBucket({
    bucketId: BUCKET_ID,
    name: 'Receipts',
    // Signed-in users can upload. Each file is readable only by its uploader.
    permissions: [Permission.create(Role.users())],
    fileSecurity: true,
    maximumFileSize: 10_000_000,
    allowedFileExtensions: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    compression: Compression.None,
    encryption: true,
    antivirus: true,
    transformations: false,
  }),
);

console.log('Done.');
