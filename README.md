# Outlay: an expense tracker with an AI receipt intake agent

Outlay is an expense tracker that files your receipts for you. Drop a photo of a receipt or a PDF
invoice into the app. An agent in an Appwrite Function reads it, fills in the merchant, date, total,
tax, currency, category, payment method, and line items, and saves the expense. When the agent is
not sure about a value, it sends that field to a review queue, where you check it next to the receipt.

The model is GPT-6 Luna through OpenRouter.

## How it works

1. The app uploads the file to the private `receipts` bucket. Only the uploader can read it.
2. The upload finishes and fires the `buckets.receipts.files.*.create` event, which starts the
   `intake-agent` function.
3. The function creates the expense row with the file ID as its row ID, so a second run for the same
   upload stops with a conflict.
4. The function creates a file token that expires in 15 minutes and gives the model a link to the
   file with that token. The model provider downloads the file from the link. The function deletes the
   token when the run ends.
5. The model looks up the user's earlier expenses from the same merchant and possible duplicates, then
   submits the fields with a confidence for each one.
6. Code decides which fields need a person. It saves the expense, line items, review flags, and the
   last timeline step in one transaction.
7. The app follows every step with Realtime: each lookup and the final result appear while the agent
   works.

Every row and file has permissions for its owner only, so each user sees only their own expenses.

## Layout

- `apps/web`: the React app (Vite, TanStack Router and Query, Tailwind CSS, shadcn/ui).
- `functions/intake-agent/src/main.js`: the entry point for the upload event and the Retry request.
- `functions/intake-agent/src/intake.js`: claims the upload, runs the agent, and saves the result.
- `functions/intake-agent/src/agent.js`: the prompt and the OpenRouter tool loop.
- `functions/intake-agent/src/tools.js`: the tool schemas and the read-only lookups.
- `functions/intake-agent/src/review.js`: the rules that send fields to the review queue.
- `functions/intake-agent/test`: unit tests with a scripted model (`pnpm test`).
- `scripts/provision.ts`: creates the database, tables, columns, indexes, and the bucket.
- `scripts/seed.ts`: creates two demo users with six months of expenses.
- `samples/`: six receipts to try, including a faded one, a duplicate, and a note that is not a receipt.
- `appwrite.config.json`: the function, for `appwrite push functions`.

## Setup

You need Node.js 22 or later, pnpm, the [Appwrite CLI](https://appwrite.io/docs/tooling/command-line/installation),
an Appwrite project, and an [OpenRouter](https://openrouter.ai) API key.

1. Install the dependencies:

   ```bash
   pnpm install
   ```

2. In the Appwrite Console, open your project and create an API key with these scopes:
   `databases.write`, `tables.write`, `columns.read`, `columns.write`, `indexes.write`,
   `buckets.write`, `files.write`, `rows.read`, `rows.write`, `tokens.write`, `users.read`, and
   `users.write`. The scripts use it. The app never does.
3. Copy `.env.example` to `.env` and fill in the endpoint, project ID, API key, and a password for the
   demo users.
4. Create the database, tables, and bucket, then add the demo data (optional):

   ```bash
   pnpm provision
   pnpm seed
   ```

5. Set `projectId` and `endpoint` in `appwrite.config.json`, sign in with `appwrite login`, and deploy
   the function:

   ```bash
   appwrite push functions
   ```

6. Set these variables on the `intake-agent` function, then redeploy it:

| Variable | Value |
| --- | --- |
| `OPENROUTER_API_KEY` | Your OpenRouter API key (mark it secret) |
| `APPWRITE_PUBLIC_ENDPOINT` | Your project's API endpoint, for example `https://fra.cloud.appwrite.io/v1`. The model provider downloads receipts from this address. |
| `OPENROUTER_MODEL` | Optional, default `openai/gpt-6-luna` |

7. Add a Web platform for `localhost` to the project.
8. Copy `apps/web/.env.example` to `apps/web/.env`, fill in the endpoint and project ID, and start the app:

   ```bash
   pnpm dev
   ```

9. Open http://localhost:5173, sign up or sign in as `nora@example.com` with the seed password, and drop
   the files from `samples/` on the page.

## Scripts

- `pnpm dev`: starts the web app.
- `pnpm build`: builds the web app.
- `pnpm provision`: creates the Appwrite resources. Safe to run again.
- `pnpm seed`: deletes and recreates the demo users' expenses and receipts.
- `pnpm test`: runs the function's unit tests.
- `pnpm typecheck`: checks the scripts.
- `pnpm samples`: renders `samples/` and the seed receipts again (run `pnpm exec playwright install chromium` first).

## License

MIT
