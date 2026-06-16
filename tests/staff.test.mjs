import test from 'node:test';
import assert from 'node:assert/strict';

import {
  STAFF,
  maeAdvancedTraining,
  eliFindHayDeal,
  vossPreventiveCare,
  getStaffSpecialty,
} from '../src/npcs.js';
import { createNewGame, applyAction } from '../src/game.js';
import { makeGame } from './helpers.js';

test('STAFF has three named staff with specialties', () => {
  assert.equal(typeof STAFF.mae, 'object');
  assert.equal(typeof STAFF.eli, 'object');
  assert.equal(typeof STAFF['dr-voss'], 'object');
  assert.equal(STAFF.mae.specialty, 'maeAdvancedTraining');
  assert.equal(STAFF.eli.specialty, 'eliFindHayDeal');
  assert.equal(STAFF['dr-voss'].specialty, 'vossPreventiveCare');
});

test('maeAdvancedTraining raises all stats and stress', () => {
  const horse = { training: 60, bond: 50, health: 80, stress: 20 };
  const after = maeAdvancedTraining(horse);
  assert.equal(after.training, 62);
  assert.equal(after.bond, 52);
  assert.equal(after.health, 82);
  assert.equal(after.stress, 34);
});

test('maeAdvancedTraining caps stats at 100', () => {
  const horse = { training: 99, bond: 99, health: 99, stress: 50 };
  const after = maeAdvancedTraining(horse);
  assert.equal(after.training, 100);
  assert.equal(after.bond, 100);
  assert.equal(after.health, 100);
});

test('eliFindHayDeal returns the cost and effect key', () => {
  const result = eliFindHayDeal();
  assert.equal(result.cost, 200);
  assert.equal(result.effect, 'hay_deal_30pct');
});

test('vossPreventiveCare lowers stress and clears light injuries', () => {
  const horses = [
    { id: 'a', name: 'A', stress: 50, health: 80, injured: false },
    { id: 'b', name: 'B', stress: 70, health: 50, injured: true },
  ];
  const after = vossPreventiveCare(horses);
  assert.equal(after[0].stress, 42);
  assert.equal(after[0].health, 81); // +1 for healthy horse
  assert.equal(after[1].stress, 62);
  assert.equal(after[1].health, 56); // +6 for injured horse
  assert.equal(after[1].injured, false);
});

test('getStaffSpecialty returns the right specialty or null', () => {
  assert.equal(getStaffSpecialty('mae'), 'maeAdvancedTraining');
  assert.equal(getStaffSpecialty('unknown'), null);
});

test('maeAdvancedTraining action improves a campaigner and costs $50', () => {
  const game = createNewGame();
  const before = game.cash;
  const blue = game.horses.find((h) => h.id === 'blue-ash');
  const after = applyAction(game, { type: 'maeAdvancedTraining', horseId: 'blue-ash' });
  const afterBlue = after.horses.find((h) => h.id === 'blue-ash');
  // Cash should drop by $50 + daily burn (760 in spring)
  assert.equal(after.cash, before - 50 - 760);
  assert.ok(afterBlue.training > blue.training);
  assert.ok(afterBlue.bond > blue.bond);
  assert.ok(afterBlue.stress > blue.stress);
});

test('maeAdvancedTraining rejects a foal', () => {
  const game = makeGame();
  game.horses = game.horses.map((h) => h.id === 'sunday-caller' ? { ...h, age: 0 } : h);
  assert.throws(() => applyAction(game, { type: 'maeAdvancedTraining', horseId: 'sunday-caller' }));
});

test('eliFindHayDeal action reduces feed cost for the next 30 days', () => {
  const game = createNewGame();
  const beforeCash = game.cash;
  const after = applyAction(game, { type: 'eliFindHayDeal' });
  assert.equal(after.hayDealDaysLeft, 29); // 30 set, then 1 decremented by dailyUpkeep
  // Cash dropped by $200 + 30%-reduced burn ($532 = 760 * 0.7)
  assert.equal(after.cash, beforeCash - 200 - 532);
});

test('vossPreventiveCare action drops stress across the herd and costs $300', () => {
  const game = createNewGame();
  const beforeStress = game.horses.reduce((s, h) => s + h.stress, 0);
  const beforeCash = game.cash;
  const after = applyAction(game, { type: 'vossPreventiveCare' });
  const afterStress = after.horses.reduce((s, h) => s + h.stress, 0);
  assert.ok(afterStress < beforeStress);
  assert.equal(after.cash, beforeCash - 300 - 760);
});

test('vossPreventiveCare requires $300', () => {
  const game = makeGame({ cash: 200 });
  assert.throws(() => applyAction(game, { type: 'vossPreventiveCare' }));
});

test('upgrade action increments the upgrade and deducts cash', () => {
  const game = makeGame({ cash: 10000, day: 50 });
  const after = applyAction(game, { type: 'upgrade', upgradeId: 'arena' });
  assert.equal(after.ranchUpgrades.arena, 1);
  assert.equal(after.cash, 6000);
  assert.equal(after.day, game.day); // upgrades do not advance the day
});

test('upgrade action refuses at max level', () => {
  const game = makeGame({ cash: 100000, ranchUpgrades: { arena: 3, vet_clinic: 0, breeding_shed: 0, hay_barn: 0 }, day: 50 });
  assert.throws(() => applyAction(game, { type: 'upgrade', upgradeId: 'arena' }));
});

test('hay barn discount lowers daily burn', () => {
  const game = makeGame({ cash: 10000, ranchUpgrades: { arena: 0, vet_clinic: 0, breeding_shed: 0, hay_barn: 1 } });
  // Spring mult 0.95, no hay deal, hay barn level 1 = 8% off
  // Burn = round(800 * 0.95 * 0.92) = round(699.2) = 699
  const after = applyAction(game, { type: 'rotatePasture' });
  assert.equal(after.cash, 10000 - 699);
});
