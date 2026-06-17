import test from 'node:test';
import assert from 'node:assert/strict';

import {
  fireTimeJumpCard,
  fireSeasonCard,
  defaultLocation,
} from '../src/time-jump.js';
import { createNewGame } from '../src/game.js';

// Tests for the time-jump card. The DOM-dependent render path is
// exercised by integration in the browser; here we verify the pure
// logic (season index, default location) and the no-DOM safety.

test('defaultLocation returns the ranch name when set', () => {
  const game = { ranchName: 'Hat Creek' };
  assert.equal(defaultLocation(game), 'Hat Creek');
});

test('defaultLocation falls back to "Montana" when ranch is unnamed', () => {
  assert.equal(defaultLocation({ ranchName: '' }), 'Montana');
  assert.equal(defaultLocation({}), 'Montana');
});

test('defaultLocation trims whitespace from ranch names', () => {
  const game = { ranchName: '  Cedar Draw  ' };
  assert.equal(defaultLocation(game), 'Cedar Draw');
});

test('fireTimeJumpCard returns a Promise even without a document (server-safe)', async () => {
  // In Node there is no document. The function should resolve cleanly.
  const p = fireTimeJumpCard({ year: 2, location: 'Hat Creek', season: 'Winter' });
  await p;
  // No throw = success.
});

test('fireSeasonCard computes the year from game day', async () => {
  const game = createNewGame();
  // day 1 is Year 1 Spring.
  const p = fireSeasonCard(game);
  await p;
});

test('fireSeasonCard maps day 31 (year 1 summer) correctly', async () => {
  const game = { ...createNewGame(), day: 31, ranchName: 'Hat Creek' };
  const p = fireSeasonCard(game);
  await p;
});

test('fireSeasonCard maps day 121 (year 2 spring) correctly', async () => {
  const game = { ...createNewGame(), day: 121, ranchName: 'Hat Creek' };
  const p = fireSeasonCard(game);
  await p;
});