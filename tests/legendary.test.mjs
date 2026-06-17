import test from 'node:test';
import assert from 'node:assert/strict';

import { createNewGame, applyAction } from '../src/game.js';
import {
  generateLegendaryHorse,
  isLegendaryRidden,
  canSellLegendary,
  maybeBondLegendary,
  applyLegendaryTrainingBonus,
  findLegendary,
  legendaryEpitaph,
  LEGENDARY_ARCHETYPES,
  DEFAULT_UNLOCK_DAY,
} from '../src/legendary.js';

test('LEGENDARY_ARCHETYPES has at least three horses', () => {
  assert.ok(LEGENDARY_ARCHETYPES.length >= 3);
  for (const a of LEGENDARY_ARCHETYPES) {
    assert.ok(a.name, 'every archetype has a name');
    assert.ok(['female', 'male'].includes(a.sex ?? 'female'), 'archetype is female by default');
  }
});

test('generateLegendaryHorse returns a horse with a legendary block', () => {
  const h = generateLegendaryHorse(Math.random, 1);
  assert.ok(h.legendary, 'expected a legendary block');
  assert.equal(h.legendary.unlockedDay, 1 + DEFAULT_UNLOCK_DAY);
  assert.ok(['hell-bitch', 'iron-pine', 'asher'].includes(h.legendary.archetypeId));
  // McMurtry detail: a mare, not a gelding.
  assert.equal(h.sex, 'female');
});

test('a new game contains exactly one legendary horse in the herd', () => {
  const game = createNewGame();
  const legendary = findLegendary(game.horses);
  assert.ok(legendary, 'expected a legendary horse');
  assert.equal(game.horses.filter((h) => h.legendary).length, 1);
});

test('isLegendaryRidden returns false before unlockedDay and true after', () => {
  const game = createNewGame();
  const leg = findLegendary(game.horses);
  assert.equal(isLegendaryRidden({ day: 1 }, leg), false);
  assert.equal(isLegendaryRidden({ day: leg.legendary.unlockedDay }, leg), true);
  assert.equal(isLegendaryRidden({ day: leg.legendary.unlockedDay + 1 }, leg), true);
});

test('isLegendaryRidden returns true for non-legendary horses', () => {
  assert.equal(isLegendaryRidden({ day: 1 }, { id: 'normal' }), true);
});

test('canSellLegendary blocks selling an unbonded legendary', () => {
  const game = createNewGame();
  const leg = findLegendary(game.horses);
  const result = canSellLegendary({ day: 200 }, leg);
  assert.equal(result.ok, false);
  assert.match(result.reason, /trust/);
});

test('canSellLegendary allows selling a bonded legendary', () => {
  const game = createNewGame();
  const leg = findLegendary(game.horses);
  const bonded = { ...leg, legendary: { ...leg.legendary, bonded: true } };
  const result = canSellLegendary({ day: 200 }, bonded);
  assert.equal(result.ok, true);
});

test('canSellLegendary returns {ok:true} for non-legendary horses', () => {
  const result = canSellLegendary({ day: 1 }, { id: 'normal' });
  assert.equal(result.ok, true);
});

test('maybeBondLegendary bonds when bond crosses 50', () => {
  const horse = { id: 'x', bond: 49, legendary: { archetypeId: 'hell-bitch', bonded: false } };
  assert.equal(maybeBondLegendary(horse).legendary.bonded, false);
  const bonded = maybeBondLegendary({ ...horse, bond: 51 });
  assert.equal(bonded.legendary.bonded, true);
});

test('maybeBondLegendary no-ops on non-legendary horses', () => {
  const horse = { id: 'x', bond: 80 };
  const result = maybeBondLegendary(horse);
  assert.equal(result, horse, 'returns the same reference');
  assert.deepEqual(result, horse);
});

test('applyLegendaryTrainingBonus adds +1 training only when bonded', () => {
  const bonded = { id: 'x', training: 50, legendary: { bonded: true } };
  const result = applyLegendaryTrainingBonus(bonded);
  assert.equal(result.training, 51);

  const notBonded = { id: 'x', training: 50, legendary: { bonded: false } };
  assert.equal(applyLegendaryTrainingBonus(notBonded), notBonded);
});

test('legendaryEpitaph returns the McMurtry line for each archetype', () => {
  for (const id of ['hell-bitch', 'iron-pine', 'asher']) {
    const horse = { name: 'TestHorse', legendary: { archetypeId: id } };
    const epitaph = legendaryEpitaph(horse);
    assert.ok(epitaph.includes('TestHorse'), `${id} should mention the horse name`);
  }
  assert.equal(legendaryEpitaph({ name: 'NoLegend' }), null);
});

test('training action is rejected on the legendary horse before unlockedDay', () => {
  let game = createNewGame();
  const leg = findLegendary(game.horses);
  assert.throws(() => applyAction(game, { type: 'train', horseId: leg.id, staffId: 'mae' }), /day.*\d+|She decides/);
});

test('training the legendary horse after unlockedDay applies the bonus', () => {
  let game = createNewGame();
  const leg = findLegendary(game.horses);
  // Jump to unlock day.
  game = { ...game, day: leg.legendary.unlockedDay };
  const before = game.horses.find((h) => h.id === leg.id);
  game = applyAction(game, { type: 'train', horseId: leg.id, staffId: 'mae' });
  const after = game.horses.find((h) => h.id === leg.id);
  // Legendary bonus: +1 training from applyLegendaryTrainingBonus,
  // then the base gain (+skillBonus+1). Mae is skill 9 → skillBonus = max(3, 5) = 5.
  // So total is +6 from skillBonus+1, plus +1 from legendary bonus.
  assert.ok(after.training > before.training, 'training must increase');
  assert.ok(after.training - before.training >= 6, `expected at least +6, got +${after.training - before.training}`);
});

test('selling a legendary horse before bonded throws an error', () => {
  let game = createNewGame();
  const leg = findLegendary(game.horses);
  assert.throws(() => applyAction(game, { type: 'sellHorse', horseId: leg.id }), /trust/);
});

test('selling a legendary horse after bonded succeeds', () => {
  let game = createNewGame();
  const leg = findLegendary(game.horses);
  // Force bonded and advanced day.
  game = {
    ...game,
    horses: game.horses.map((h) => h.id === leg.id ? { ...h, legendary: { ...h.legendary, bonded: true } } : h),
    day: leg.legendary.unlockedDay + 1,
  };
  const before = game.horses.length;
  game = applyAction(game, { type: 'sellHorse', horseId: leg.id });
  assert.equal(game.horses.length, before - 1);
  // The last memorial should be a sale of the legendary.
  const last = game.memorials[game.memorials.length - 1];
  assert.equal(last.kind, 'sold');
  assert.equal(last.horseName, leg.name);
});