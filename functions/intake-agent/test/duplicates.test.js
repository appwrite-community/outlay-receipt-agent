import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pickDuplicate } from '../src/intake.js';

const expense = { $id: 'new-upload', ownerId: 'nora' };
const data = { merchant: 'Harbor Light Cafe', spentOn: '2026-09-18T00:00:00.000+00:00', totalMinor: 2390, currency: 'USD' };
const row = (id, merchant, date) => ({ $id: id, merchant, spentOn: `${date}T00:00:00.000+00:00`, totalMinor: 2390, currency: 'USD' });

/** A stand-in for TablesDB that records queries and returns fixed rows. */
function fakeTablesDB(rows) {
  const calls = [];
  return { calls, listRows: async (params) => (calls.push(params), { rows }) };
}

test('keeps the model choice only when the lookup returned that expense', async () => {
  const match = { id: 'seeded', merchant: 'Harbor Light Cafe', date: '2026-09-18', total: 23.9, currency: 'USD' };
  const check = { ran: true, matches: new Map([['seeded', match]]) };
  const tablesDB = fakeTablesDB([]);

  assert.equal(await pickDuplicate({ tablesDB }, expense, { duplicateOf: 'seeded' }, data, check), match);
  assert.equal(await pickDuplicate({ tablesDB }, expense, { duplicateOf: 'made-up-id' }, data, check), null);
  assert.equal(tablesDB.calls.length, 0);
});

test('runs the lookup itself when the model skipped it, and keeps only the same receipt', async () => {
  const check = { ran: false, matches: new Map() };
  const tablesDB = fakeTablesDB([row('other-day', 'Harbor Light Cafe', '2026-09-17'), row('same', 'HARBOR LIGHT CAFE', '2026-09-18')]);

  const duplicate = await pickDuplicate({ tablesDB }, expense, { duplicateOf: null }, data, check);
  assert.equal(duplicate.id, 'same');
  assert.equal(tablesDB.calls.length, 1);
  assert.ok(tablesDB.calls[0].queries.some((query) => query.includes('"ownerId"') && query.includes('"nora"')));
});

test('a match with the same total from another merchant is not a duplicate', async () => {
  const tablesDB = fakeTablesDB([row('kinjo', 'Kinjo Noodle Bar', '2026-09-18')]);
  assert.equal(await pickDuplicate({ tablesDB }, expense, { duplicateOf: null }, data, { ran: false, matches: new Map() }), null);
});
