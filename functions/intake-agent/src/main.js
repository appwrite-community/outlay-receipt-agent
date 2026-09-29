import { createServices } from './appwrite.js';
import { handleRetry, handleUpload } from './intake.js';

function readJson(req) {
  try {
    return req.bodyJson;
  } catch {
    return null;
  }
}

/**
 * Two triggers reach this function:
 * - event: a file upload finished in the receipts bucket.
 * - http: the app asks for a retry of a failed or rejected expense.
 */
export default async ({ req, res, log, error }) => {
  const ctx = { ...createServices(req), log, error };
  // Appwrite sets this header. It is the uploader for events and the caller for HTTP requests.
  const userId = req.headers['x-appwrite-user-id'];

  if (req.headers['x-appwrite-trigger'] === 'event') {
    await handleUpload(ctx, req.bodyJson, userId);
    return res.empty();
  }

  if (req.method !== 'POST') return res.json({ message: 'Send a POST request.' }, 405);
  const { status, body } = await handleRetry(ctx, readJson(req), userId);
  return res.json(body, status);
};
