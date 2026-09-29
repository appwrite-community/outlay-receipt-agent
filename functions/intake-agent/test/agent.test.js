import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FilingError, runAgent } from '../src/agent.js';

/** A stand-in for the OpenAI client that answers with scripted assistant messages. */
function scriptedModel(...replies) {
  const requests = [];
  return {
    requests,
    chat: {
      completions: {
        create: async (request) => {
          requests.push(structuredClone(request));
          const message = replies.shift();
          if (!message) throw new Error('No scripted reply left');
          return { choices: [{ message: { role: 'assistant', content: null, ...message } }] };
        },
      },
    },
  };
}

const call = (id, name, args) => ({
  id,
  type: 'function',
  function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) },
});

const field = (value) => ({ value, confidence: 'high', note: null });
const SUBMISSION = {
  merchant: field('Harbor Light Cafe'),
  date: field('2026-09-18'),
  total: field(23.9),
  tax: field(1.9),
  currency: field('USD'),
  category: field('meals'),
  paymentMethod: field(null),
  lineItems: [],
  duplicateOf: null,
  summary: 'Lunch.',
};

const run = (openai, lookups = {}) =>
  runAgent({
    document: { name: 'receipt.pdf', mimeType: 'application/pdf', url: 'https://files.example.com/receipt.pdf' },
    homeCurrency: 'USD',
    today: '2026-09-29',
    lookups,
    openai,
  });

test('runs lookups, sends their results back, and stops at submit_expense', async () => {
  const openai = scriptedModel(
    { tool_calls: [call('a', 'find_merchant_history', { merchant: 'Harbor Light Cafe' })] },
    { tool_calls: [call('b', 'submit_expense', SUBMISSION)] },
  );
  const outcome = await run(openai, { find_merchant_history: async () => ({ matches: [] }) });

  assert.deepEqual(outcome, { tool: 'submit_expense', args: SUBMISSION });
  const [first, second] = openai.requests;
  assert.equal(first.tool_choice, 'required');
  assert.deepEqual(first.messages[1].content[1], {
    type: 'file',
    file: { filename: 'receipt.pdf', file_data: 'https://files.example.com/receipt.pdf' },
  });
  assert.deepEqual(second.messages.at(-1), { role: 'tool', tool_call_id: 'a', content: '{"matches":[]}' });
});

test('invalid arguments go back to the model as an error instead of ending the run', async () => {
  const openai = scriptedModel(
    { tool_calls: [call('a', 'submit_expense', '{"merchant": ')] },
    { tool_calls: [call('b', 'submit_expense', { merchant: 'no other fields' })] },
    { tool_calls: [call('c', 'find_receipt_owner', { name: 'x' })] },
    { tool_calls: [call('d', 'reject_document', { reason: 'This is a to-do note.' })] },
  );
  const outcome = await run(openai);

  assert.deepEqual(outcome, { tool: 'reject_document', args: { reason: 'This is a to-do note.' } });
  const toolReplies = openai.requests.at(-1).messages.filter((message) => message.role === 'tool');
  assert.deepEqual(
    toolReplies.map((message) => JSON.parse(message.content).error),
    [
      'The arguments do not match the submit_expense schema. Call it again.',
      'The arguments do not match the submit_expense schema. Call it again.',
      'There is no tool named find_receipt_owner.',
    ],
  );
});

test('a reply without tool calls gets a reminder', async () => {
  const openai = scriptedModel({ content: 'Here is the expense.' }, { tool_calls: [call('a', 'submit_expense', SUBMISSION)] });
  await run(openai);
  assert.deepEqual(openai.requests[1].messages.at(-1), {
    role: 'user',
    content: 'Finish with submit_expense or reject_document.',
  });
});

test('gives up after five rounds without a terminal tool', async () => {
  const lookup = { tool_calls: [call('a', 'find_merchant_history', { merchant: 'Harbor' })] };
  const openai = scriptedModel(lookup, lookup, lookup, lookup, lookup, lookup);
  await assert.rejects(run(openai, { find_merchant_history: async () => ({ matches: [] }) }), FilingError);
  assert.equal(openai.requests.length, 5);
});
