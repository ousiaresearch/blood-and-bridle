import test from 'node:test';
import assert from 'node:assert/strict';

import {
  OWEN_TEN,
  AUTRY_TEN,
  FOLK_FRAGMENTS,
  MCMURTRY_FRAGMENTS,
  CODEX_COLLECTIONS,
  allCodexEntries,
  earnedCodexEntries,
  lockedCodexEntries,
  renderCodex,
} from '../src/codex.js';
import { createNewGame } from '../src/game.js';

test('OWEN_TEN has all ten principles from Cowboy Ethics', () => {
  assert.equal(OWEN_TEN.length, 10);
  assert.ok(OWEN_TEN.some((e) => e.text.toLowerCase().includes('courage')));
  assert.ok(OWEN_TEN.some((e) => e.text.toLowerCase().includes('ride for the brand')));
  assert.ok(OWEN_TEN.some((e) => e.text.toLowerCase().includes('talk less')));
});

test('AUTRY_TEN has ten rules from Gene Autry', () => {
  assert.equal(AUTRY_TEN.length, 10);
  assert.ok(AUTRY_TEN.some((e) => e.text.toLowerCase().includes('truth')));
  assert.ok(AUTRY_TEN.some((e) => e.text.toLowerCase().includes('children')));
});

test('FOLK_FRAGMENTS includes the canonical "spurs" line', () => {
  assert.ok(FOLK_FRAGMENTS.some((e) => e.text.toLowerCase().includes('spurs')));
});

test('MCMURTRY_FRAGMENTS includes the "talk\u2019s the way to kill it" line', () => {
  assert.ok(MCMURTRY_FRAGMENTS.some((e) => e.text.includes('Talk')));
});

test('CODEX_COLLECTIONS aggregates the four collections', () => {
  assert.equal(CODEX_COLLECTIONS.length, 4);
  const ids = CODEX_COLLECTIONS.map((c) => c.id);
  assert.ok(ids.includes('owen'));
  assert.ok(ids.includes('autry'));
  assert.ok(ids.includes('folk'));
  assert.ok(ids.includes('mcmurtry'));
});

test('allCodexEntries flattens with collection metadata', () => {
  const all = allCodexEntries();
  assert.equal(all.length, OWEN_TEN.length + AUTRY_TEN.length + FOLK_FRAGMENTS.length + MCMURTRY_FRAGMENTS.length);
  assert.ok(all.every((e) => e.collection && e.collectionLabel));
});

test('earnedCodexEntries returns at least 5 folk fragments on a fresh game', () => {
  const game = createNewGame();
  const earned = earnedCodexEntries(game);
  assert.ok(earned.length >= 5, `expected at least 5 folk fragments, got ${earned.length}`);
  assert.ok(earned.includes('folk-01'));
  assert.ok(earned.includes('folk-02'));
});

test('earnedCodexEntries unlocks Owen 01-04 when legacy reaches 30', () => {
  const game = { ...createNewGame(), legacy: 35 };
  const earned = earnedCodexEntries(game);
  assert.ok(earned.includes('owen-01'));
  assert.ok(earned.includes('owen-02'));
  assert.ok(earned.includes('owen-03'));
  assert.ok(earned.includes('owen-04'));
});

test('earnedCodexEntries unlocks Owen 07 after legendary horse unlocks', () => {
  const game = { ...createNewGame(), day: 200, legendaryUnlockedDay: 91 };
  const earned = earnedCodexEntries(game);
  assert.ok(earned.includes('owen-07'));
});

test('earnedCodexEntries unlocks McMurtry fragments after memorials', () => {
  const game = {
    ...createNewGame(),
    memorials: [
      { kind: 'death', age: 14, horseName: 'X' },
      { kind: 'death', age: 15, horseName: 'Y' },
      { kind: 'death', age: 16, horseName: 'Z' },
    ],
  };
  const earned = earnedCodexEntries(game);
  assert.ok(earned.includes('mcmurtry-01'));
  assert.ok(earned.includes('mcmurtry-02'));
  assert.ok(earned.includes('mcmurtry-03'));
});

test('lockedCodexEntries returns the inverse with conditions', () => {
  const game = createNewGame();
  const locked = lockedCodexEntries(game);
  assert.ok(locked.length > 0);
  assert.ok(locked.every((e) => e.condition));
  // owen-10 should be locked on a fresh game.
  assert.ok(locked.some((e) => e.id === 'owen-10'));
});

test('renderCodex produces all four collection sections with entry counts', () => {
  const game = createNewGame();
  const html = renderCodex(game);
  assert.match(html, /codex-collection/);
  assert.match(html, /Owen/);
  assert.match(html, /Autry/);
  assert.match(html, /Folk/);
  assert.match(html, /Earned/);
  assert.match(html, /fragments earned/);
});

test('renderCodex marks locked entries with a placeholder', () => {
  const game = createNewGame();
  const html = renderCodex(game);
  assert.match(html, /codex-entry--locked/);
  assert.match(html, /\[ locked \]/);
});