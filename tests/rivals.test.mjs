import test from 'node:test';
import assert from 'node:assert/strict';

import { tickRivals, RIVALS, recordRivalPurchase } from '../src/rivals.js';

test('tickRivals grows rival cash over time', () => {
  const before = RIVALS[0].cash;
  tickRivals({});
  assert.ok(RIVALS[0].cash > before);
});

test('recordRivalPurchase adds horse to rival herd and subtracts cash', () => {
  const cash = RIVALS[0].cash;
  const herdLen = RIVALS[0].herd.length;
  recordRivalPurchase('callahan', 'a-cool-horse', 5000);
  assert.equal(RIVALS[0].herd.length, herdLen + 1);
  assert.equal(RIVALS[0].cash, cash - 5000);
});

test('recordRivalPurchase on unknown rival is a no-op', () => {
  const before = RIVALS.length;
  recordRivalPurchase('nobody', 'horse', 1);
  assert.equal(RIVALS.length, before);
});
