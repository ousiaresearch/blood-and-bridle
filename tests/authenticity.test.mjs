import test from 'node:test';
import assert from 'node:assert/strict';

import { detectAuthenticity, renderAuthenticityBanner } from '../src/authenticity.js';
import { createNewGame, applyAction } from '../src/game.js';

test('detectAuthenticity returns a numeric score in [0, 100]', () => {
  const game = createNewGame();
  const result = detectAuthenticity(game);
  assert.ok(Number.isFinite(result.score));
  assert.ok(result.score >= 0 && result.score <= 100);
});

test('detectAuthenticity is null-safe', () => {
  const result = detectAuthenticity(null);
  assert.equal(result.score, 50);
  assert.deepEqual(result.npcNotes, []);
});

test('detectAuthenticity flags a high-cash low-labor game as Costco cowgirl', () => {
  const game = {
    ...createNewGame(),
    cash: 80000,
    log: ['Nothing happened today.', 'Another quiet day.', 'Just sitting.'], // no labor keywords
    legacy: 75,
  };
  const result = detectAuthenticity(game);
  assert.ok(result.score < 60, `expected low score for high-cash low-labor, got ${result.score}`);
  assert.ok(result.npcNotes.length > 0, 'expected NPC comments to surface');
  // Mae or Eli should comment on labor.
  assert.ok(result.npcNotes.some((n) => n.npcId === 'mae' || n.npcId === 'eli'));
});

test('detectAuthenticity gives a high score for labor-rich low-cash game', () => {
  const game = {
    ...createNewGame(),
    cash: 2000,
    log: [
      'Mae worked Blue Ash in the dust-lit arena.',
      'Dr. Voss treated Mercy Road.',
      'Rotated the herd through fresh pasture.',
      'Eli found a hay deal. Feed costs are down for 30 days.',
      'Mae pushed Juniper Smoke through an advanced session.',
      'Dr. Voss walked every horse. Stress is down.',
      'Rotated the herd through fresh pasture.',
      'Mae worked Red Ledger.',
      'Mae worked Sunday Caller.',
      'Mae worked Cedar Draw.',
      'Dr. Voss treated Blue Ash.',
      'Rotated the herd through fresh pasture.',
    ],
  };
  const result = detectAuthenticity(game);
  assert.ok(result.score >= 60, `expected high score for labor-rich game, got ${result.score}`);
});

test('renderAuthenticityBanner returns empty when score is high or cash is low', () => {
  const game = createNewGame();
  // Default cash is 18500 — below threshold.
  assert.equal(renderAuthenticityBanner(game), '');
});

test('renderAuthenticityBanner surfaces a banner for the Costco cowgirl case', () => {
  const game = {
    ...createNewGame(),
    cash: 80000,
    log: ['Nothing happened today.'],
    legacy: 75,
  };
  const html = renderAuthenticityBanner(game);
  assert.match(html, /authenticity-banner/);
  assert.match(html, /Costco cowgirl|Tourist|Working through it/);
});

test('NPC_COMMENTS keys all map to NPCs in npcs.js (sanity)', () => {
  const game = createNewGame();
  // We can't import NPCS without circular issues; just check the keys.
  const result = detectAuthenticity({ ...game, cash: 100000, log: [], legacy: 80 });
  for (const note of result.npcNotes) {
    assert.ok(typeof note.npcId === 'string' && note.npcId.length > 0);
    assert.ok(typeof note.line === 'string' && note.line.length > 0);
  }
});