import { Client } from 'node-appwrite';

export const DATABASE_ID = 'outlay';
export const BUCKET_ID = 'receipts';

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} in .env (see .env.example)`);
  return value;
}

/** A server client with the API key from .env. Scripts only: never ship this key to a browser. */
export function createAdminClient(): Client {
  return new Client()
    .setEndpoint(requireEnv('APPWRITE_ENDPOINT'))
    .setProject(requireEnv('APPWRITE_PROJECT_ID'))
    .setKey(requireEnv('APPWRITE_API_KEY'));
}
