import { Client, Permission, Role, TablesDB, Tokens, Users } from 'node-appwrite';

export const DATABASE_ID = 'outlay';
export const BUCKET_ID = 'receipts';
export const TABLES = {
  expenses: 'expenses',
  lineItems: 'line_items',
  flags: 'review_flags',
  activity: 'activity',
};

/**
 * Services authenticated with the execution's dynamic API key. The key only
 * has the scopes listed in the function settings.
 */
export function createServices(req) {
  const client = new Client()
    .setEndpoint(process.env.APPWRITE_FUNCTION_API_ENDPOINT)
    .setProject(process.env.APPWRITE_FUNCTION_PROJECT_ID)
    .setKey(req.headers['x-appwrite-key']);

  return {
    tablesDB: new TablesDB(client),
    tokens: new Tokens(client),
    users: new Users(client),
  };
}

/** Row permissions that give one user the listed actions and nobody else anything. */
export function ownerPermissions(userId, actions = ['read', 'update', 'delete']) {
  return actions.map((action) => Permission[action](Role.user(userId)));
}

/** Logs an Appwrite or model error without request details, headers, or tokens. */
export function describeError(err) {
  const parts = [err.code ?? err.status, err.type, err.message].filter(Boolean);
  return parts.join(' ').replace(/token=[^&\s"]+/g, 'token=<hidden>');
}
