import test from 'node:test';
import assert from 'node:assert/strict';

import { tickRivals, RIVALS, recordRivalPurchase } from '../src/rivals.js';

test('tickRivals grows rival cash over time', () => {
  const before = RIVALS[0].cash;
  tickRivals({});
  assert.ok(RIVALS[0].cash > before);
});

test('recordRivalPurchase adds horse to rival herd and subtracts cash', () => {
  // Phase 12 — RIVALS now contains the family rivals (William, Cobb,
  // Edith, Henry Whitehorse). Pick a known id and assert behavior.
  const rival = RIVALS.find((r) => r.id === 'cobb-blood') ?? RIVALS[0];
  const cash = rival.cash;
  const herdLen = rival.herd.length;
  recordRivalPurchase(rival.id, 'a-cool-horse', 5000);
  assert.equal(rival.herd.length, herdLen + 1);
  assert.equal(rival.cash, cash - 5000);
});

test('recordRivalPurchase on unknown rival is a no-op', () => {
  const before = RIVALS.length;
  recordRivalPurchase('nobody', 'horse', 1);
  assert.equal(RIVALS.length, before);
});

test('RIVALS contains the four family rivals', () => {
  const ids = RIVALS.map((r) => r.id);
  assert.ok(ids.includes('william-blood'), 'has William');
  assert.ok(ids.includes('cobb-blood'), 'has Cobb');
  assert.ok(ids.includes('edith-crane'), 'has Edith');
  assert.ok(ids.includes('henry-whitehorse'), 'has Henry');
});

test('every rival has a portraitId', () => {
  for (const r of RIVALS) {
    assert.ok(r.portraitId, `${r.id} has a portraitId`);
  }
});

test('family rivals grow slower than working-ranch rivals', () => {
  const family = RIVALS.find((r) => r.id === 'cobb-blood');
  const working = RIVALS.find((r) => r.id === 'henry-whitehorse');
  assert.equal(family.family, true);
  assert.equal(working.family, false);
  // Family: 1.025 growth, working: 1.04 growth. Verify via tick.
  const familyBefore = family.cash;
  const workingBefore = working.cash;
  // Reset to known state for the comparison.
  family.cash = 10000;
  working.cash = 10000;
  tickRivals({});
  assert.ok(family.cash < working.cash, 'family grows slower');
  // Restore so the test doesn't accumulate.
  family.cash = familyBefore;
  working.cash = workingBefore;
});

test('getRivalByAnyId resolves canonical and aliased ids', async () => {
  const { getRivalByAnyId } = await import('../src/rivals.js');
  assert.equal(getRivalByAnyId('william-blood')?.id, 'william-blood');
  assert.equal(getRivalByAnyId('cobb-blood')?.id, 'cobb-blood');
  assert.equal(getRivalByAnyId('nobody'), null);
});