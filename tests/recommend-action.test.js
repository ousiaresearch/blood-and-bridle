// Phase 15 Sheridan lift — recommendAction chooses a sensible primary
// action based on current game state. The recommendation should:
//
//  1. Return null when the game is empty (no actions available).
//  2. Return 'takeBoarders' when cash is low AND the player has livestock.
//  3. Return 'enterShow' when reputation is below 50 AND a campaigner exists.
//  4. Return 'train' when cash is healthy AND a campaigner exists.
//  5. Return 'breed' when two horses exist and no breeding is pending.
//  6. Return 'rotatePasture' when pasture is stale.
//  7. Honor imminent due date — pending breeding within 3 days triggers
//     'enterShow' regardless of the cash check above.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendAction } from '../src/game.js';

const baseGame = (overrides = {}) => ({
  cash: 20000,
  horses: [
    { id: 'h1', name: 'Blue Ash', role: 'campaigner' },
    { id: 'h2', name: 'Mercy Road', role: 'ranch' },
  ],
  reputation: 60,
  developerPressure: 30,
  pasture: [{ turnsSinceRest: 0 }],
  pendingBreeding: null,
  ...overrides,
});

test('recommendAction returns null when no horses available', () => {
  const g = baseGame({ horses: [] });
  // No horses + no specific trigger → falls through to null fallback
  // (caller picks first available primary from the action list).
  const result = recommendAction(g);
  // With no horses, no campaigner check fires, no breed check fires.
  // Cash 20000 >= 2000 but no campaigner → fall through to null.
  assert.equal(result, null);
});

test('recommendAction returns takeBoarders when cash is low and horses exist', () => {
  const g = baseGame({ cash: 3000 });
  assert.equal(recommendAction(g), 'takeBoarders');
});

test('recommendAction returns enterShow when reputation is low and campaigner exists', () => {
  const g = baseGame({ reputation: 30 });
  assert.equal(recommendAction(g), 'enterShow');
});

test('recommendAction returns train when cash is healthy and campaigner exists', () => {
  const g = baseGame({ cash: 25000, reputation: 60 });
  assert.equal(recommendAction(g), 'train');
});

test('recommendAction returns breed when two horses exist and no pending breeding', () => {
  const g = baseGame({
    horses: [
      { id: 'h1', name: 'A', role: 'ranch' },
      { id: 'h2', name: 'B', role: 'ranch' },
    ],
    cash: 5000, // >=4000 → skip takeBoarders; no campaigner → skip train
    reputation: 80, // >=50 → skip enterShow
  });
  assert.equal(recommendAction(g), 'breed');
});

test('recommendAction returns rotatePasture when pasture is stale', () => {
  const g = baseGame({
    horses: [{ id: 'h1', name: 'A', role: 'ranch' }],
    cash: 100,
    reputation: 80,
    pendingBreeding: { daysUntilDue: 30 }, // far from due
    pasture: [{ turnsSinceRest: 6 }],
  });
  assert.equal(recommendAction(g), 'rotatePasture');
});

test('recommendAction honors imminent breeding due date (preempts train)', () => {
  const g = baseGame({
    cash: 25000,
    reputation: 60,
    pendingBreeding: { daysUntilDue: 2 },
  });
  // Cash is healthy + campaigner present would normally pick 'train',
  // but the imminent due date should preempt.
  assert.equal(recommendAction(g), 'enterShow');
});

test('recommendAction handles missing optional fields without throwing', () => {
  const g = {
    cash: 20000,
    horses: [{ id: 'h1', name: 'A', role: 'campaigner' }],
    // reputation, developerPressure, pasture, pendingBreeding all missing
  };
  // reputation defaults to 0 (via ?? 0), triggering enterShow before train.
  assert.equal(recommendAction(g), 'enterShow');
});