import test from 'node:test';
import assert from 'node:assert/strict';

import { canBreed, queueBreeding, deliverFoals, GESTATION_DAYS } from '../src/breeding.js';
import { createNewGame, applyAction } from '../src/game.js';
import { seedTraits } from '../src/horse.js';
import { makeGame } from './helpers.js';

test('canBreed rejects two horses of the same sex', () => {
  const sire = { id: 's', name: 'S', sex: 'male', age: 6, injured: false, stress: 30, traits: seedTraits() };
  const dam  = { id: 'd', name: 'D', sex: 'male', age: 6, injured: false, stress: 30, traits: seedTraits() };
  const r = canBreed(sire, dam);
  assert.equal(r.ok, false);
  assert.match(r.reason, /stallion and one mare/);
});

test('canBreed rejects horses outside the 4-12 age window', () => {
  const young = { id: 'y', name: 'Young', sex: 'female', age: 2, injured: false, stress: 30, traits: seedTraits() };
  const sire  = { id: 's', name: 'Sire', sex: 'male', age: 6, injured: false, stress: 30, traits: seedTraits() };
  assert.equal(canBreed(sire, young).ok, false);
});

test('canBreed rejects injured horses', () => {
  const sire = { id: 's', name: 'S', sex: 'male', age: 6, injured: true, stress: 30, traits: seedTraits() };
  const dam  = { id: 'd', name: 'D', sex: 'female', age: 6, injured: false, stress: 30, traits: seedTraits() };
  assert.equal(canBreed(sire, dam).ok, false);
});

test('canBreed accepts a healthy campaigner pair', () => {
  const sire = { id: 's', name: 'S', sex: 'male', age: 6, injured: false, stress: 30, traits: seedTraits() };
  const dam  = { id: 'd', name: 'D', sex: 'female', age: 6, injured: false, stress: 30, traits: seedTraits() };
  assert.equal(canBreed(sire, dam).ok, true);
});

test('queueBreeding records a pending breeding with a due day', () => {
  const game = makeGame();
  const next = queueBreeding(game, 'mercy-road', 'blue-ash');
  assert.ok(next.pendingBreeding);
  assert.equal(next.pendingBreeding.dueDay, game.day + GESTATION_DAYS);
});

test('deliverFoals produces a foal with parents recorded', () => {
  let game = makeGame();
  game = queueBreeding(game, 'mercy-road', 'blue-ash');
  game = { ...game, day: game.pendingBreeding.dueDay };
  const { game: g, delivered } = deliverFoals(game);
  assert.equal(delivered.length, 1);
  assert.equal(g.horses.length, 7);
  assert.ok(g.horses.find((h) => h.parents?.includes('mercy-road')));
  assert.equal(g.pendingBreeding, null);
});

test('foal has trait values between parents', () => {
  let game = makeGame();
  game.horses = game.horses.map((h) => {
    if (h.id === 'mercy-road') return { ...h, traits: { gait_quality: 90, temperament_stability: 90, bone_density: 90, heart: 90, conformation: 90 } };
    if (h.id === 'blue-ash')   return { ...h, traits: { gait_quality: 10, temperament_stability: 10, bone_density: 10, heart: 10, conformation: 10 } };
    return h;
  });
  game = queueBreeding(game, 'mercy-road', 'blue-ash');
  game = { ...game, day: game.pendingBreeding.dueDay };
  const { delivered } = deliverFoals(game);
  const foal = delivered[0];
  assert.ok(foal.traits.gait_quality >= 30 && foal.traits.gait_quality <= 70, `gait ${foal.traits.gait_quality}`);
});
