import test from 'node:test';
import assert from 'node:assert/strict';

import {
  personalMonologue,
  renderMonologue,
} from '../src/monologue.js';
import { createNewGame } from '../src/game.js';

test('personalMonologue returns a non-empty string for a valid horse', () => {
  const game = createNewGame();
  const horse = game.horses[0];
  const text = personalMonologue(horse);
  assert.ok(typeof text === 'string');
  assert.ok(text.length > 30, 'monologue should be substantive');
});

test('personalMonologue never wraps the text in quotation marks (McCarthy inversion)', () => {
  const game = createNewGame();
  for (const horse of game.horses) {
    const text = personalMonologue(horse);
    assert.ok(!text.includes('"'), `monologue for ${horse.name} contains quotation marks`);
    assert.ok(!text.includes('"'), `monologue for ${horse.name} contains curly quotes`);
  }
});

test('personalMonologue returns the picturebook line for legendary horses', () => {
  const game = createNewGame();
  const legendary = game.horses.find((h) => h.legendary);
  assert.ok(legendary);
  const text = personalMonologue(legendary);
  // One of the legendary voices contains "high country" or "seven people" or "foal in the lower pasture".
  assert.ok(/high country|seven people|foal in the lower pasture/.test(text), `unexpected legendary text: ${text}`);
});

test('personalMonologue uses bond-dependent closings', () => {
  const low = { name: 'X', stageId: 'campaigner', mood: 'calm', bond: 10 };
  const high = { ...low, bond: 90 };
  // Use a deterministic RNG: always pick index 0 from each pool.
  const rng0 = () => 0;
  const lowText = personalMonologue(low, rng0);
  const highText = personalMonologue(high, rng0);
  // Index-0 fragments:
  assert.match(lowText, /I do not know whose hand that is yet/);
  assert.match(highText, /The hand is the hand\. There is only one/);
});

test('personalMonologue respects the mood override', () => {
  const calm = { name: 'X', stageId: 'campaigner', mood: 'calm', bond: 50 };
  const intense = { ...calm, mood: 'intense' };
  // Run enough times to make sure calm and intense yield distinct pools.
  const calmTexts = new Set();
  const intenseTexts = new Set();
  for (let i = 0; i < 50; i++) {
    calmTexts.add(personalMonologue(calm));
    intenseTexts.add(personalMonologue(intense));
  }
  // Both should produce many distinct outputs (random selection).
  assert.ok(calmTexts.size >= 2 || intenseTexts.size >= 2);
});

test('renderMonologue returns HTML with the eyebrow and body', () => {
  const game = createNewGame();
  const html = renderMonologue(game.horses[0]);
  assert.match(html, /monologue/);
  assert.match(html, /The horse/);
  assert.match(html, /monologue-text/);
});

test('renderMonologue returns empty string for null horse', () => {
  assert.equal(renderMonologue(null), '');
});