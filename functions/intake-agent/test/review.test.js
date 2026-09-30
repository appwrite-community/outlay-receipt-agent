import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMoney, toMinor } from '../src/money.js';
import { normalizeSubmission } from '../src/normalize.js';
import { reviewFlags } from '../src/review.js';

const high = (value) => ({ value, confidence: 'high', note: null });

function submission(overrides = {}) {
  return {
    merchant: high('Cedar Loop Coworking'),
    date: high('2026-09-24'),
    total: high(78.3),
    tax: high(null),
    currency: high('USD'),
    category: high('office'),
    paymentMethod: high('Visa ending 4417'),
    lineItems: [
      { description: 'Day pass', quantity: 1, amount: 28 },
      { description: 'Meeting room, 2 h', quantity: 2, amount: 40 },
      { description: 'Printing', quantity: 12, amount: 3.6 },
      { description: 'Cold brew', quantity: 1, amount: 6.7 },
    ],
    duplicateOf: null,
    summary: 'Coworking day pass and meeting room.',
    ...overrides,
  };
}

function flagsFor(input, { homeCurrency = 'USD', duplicate = null, today = '2026-09-29' } = {}) {
  const { data, lineItems, issues } = normalizeSubmission(input, { homeCurrency });
  return reviewFlags({ submission: input, data, lineItems, issues, duplicate, today });
}

test('money uses the minor units of each currency', () => {
  assert.equal(toMinor(44.49, 'USD'), 4449);
  assert.equal(toMinor(1200, 'JPY'), 1200);
  assert.equal(toMinor(1.234, 'BHD'), 1234);
  assert.equal(formatMoney(4449, 'USD'), '$44.49');
});

test('a clean receipt needs no review', () => {
  assert.deepEqual(flagsFor(submission()), []);
});

test('low confidence flags any field, medium only money and dates', () => {
  const flags = flagsFor(
    submission({
      merchant: { value: 'Cedar Loop Coworking', confidence: 'low', note: 'Logo is faded.' },
      category: { value: 'office', confidence: 'medium', note: 'Inferred from the items.' },
      total: { value: 78.3, confidence: 'medium', note: 'Calculated from the lines.' },
    }),
  );
  assert.deepEqual(
    flags.map((flag) => [flag.field, flag.source, flag.reason, flag.agentValue]),
    [
      ['merchant', 'model', 'Logo is faded.', 'Cedar Loop Coworking'],
      ['total', 'model', 'Calculated from the lines.', '78.30'],
    ],
  );
});

test('line items that do not add up are flagged, with or without tax', () => {
  const withTax = submission({ total: high(44.49), tax: high(3.49), lineItems: [{ description: 'Plan', quantity: 1, amount: 41 }] });
  assert.deepEqual(flagsFor(withTax), []);

  const [flag] = flagsFor(submission({ lineItems: [{ description: 'Day pass', quantity: 1, amount: 28 }] }));
  assert.equal(flag.field, 'lineItems');
  assert.equal(flag.reason, 'Line items add up to $28.00, the total is $78.30.');
});

test('checks catch missing, future, and old values', () => {
  const fields = (input) => flagsFor(input).map((flag) => `${flag.field}: ${flag.reason}`);
  assert.deepEqual(fields(submission({ total: high(null), lineItems: [] })), ['total: No total found.']);
  assert.deepEqual(fields(submission({ date: high('2026-10-05') })), ['spentOn: The date is in the future.']);
  assert.deepEqual(fields(submission({ date: high('2025-06-01') })), ['spentOn: The date is more than a year ago.']);
  assert.deepEqual(fields(submission({ date: high('Sept 24') })), ['spentOn: "Sept 24" is not a valid date.']);
  assert.deepEqual(fields(submission({ category: high(null) })), ['category: No category was chosen.']);
});

test('a missing currency falls back to the home currency and is flagged', () => {
  const input = submission({ currency: high(null) });
  const { data } = normalizeSubmission(input, { homeCurrency: 'EUR' });
  assert.equal(data.currency, 'EUR');
  const [flag] = flagsFor(input, { homeCurrency: 'EUR' });
  assert.deepEqual([flag.field, flag.source, flag.agentValue], ['currency', 'check', 'EUR']);
});

test('an unsure answer about a missing optional value is not a flag', () => {
  const input = submission({ tax: { value: null, confidence: 'low', note: 'No tax is listed.' } });
  assert.deepEqual(flagsFor(input), []);
  assert.equal(normalizeSubmission(input, { homeCurrency: 'USD' }).data.fieldNotes, null);
});

test('a missing merchant is flagged by a check, with the model note', () => {
  const [flag] = flagsFor(submission({ merchant: { value: null, confidence: 'low', note: 'Logo only.' } }));
  assert.deepEqual([flag.field, flag.source, flag.reason], ['merchant', 'check', 'Logo only. No merchant found.']);
});

test('model and check reasons for one field merge into one flag', () => {
  const flags = flagsFor(submission({ total: { value: 0, confidence: 'low', note: 'Smudged.' }, lineItems: [] }));
  assert.equal(flags.length, 1);
  assert.deepEqual([flags[0].source, flags[0].reason], ['check', 'Smudged. The total is not a positive amount.']);
});

test('a duplicate becomes a flag that points at the other expense', () => {
  const duplicate = { id: 'abc', merchant: 'Harbor Light Cafe', date: '2026-09-18', total: 23.9, currency: 'USD' };
  const [flag] = flagsFor(submission(), { duplicate });
  assert.deepEqual([flag.field, flag.relatedExpenseId, flag.reason], [
    'duplicate',
    'abc',
    'Harbor Light Cafe on Sep 18, 2026 has the same total.',
  ]);
});
