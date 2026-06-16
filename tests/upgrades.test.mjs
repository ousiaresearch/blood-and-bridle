import test from 'node:test';
import assert from 'node:assert/strict';

import {
  UPGRADES,
  MAX_LEVEL,
  getUpgradeCost,
  getUpgradeLabel,
  getUpgradeEffect,
  canAffordUpgrade,
  applyUpgrade,
  getRanchEffects,
} from '../src/upgrades.js';
import { createNewGame } from '../src/game.js';
import { makeGame } from './helpers.js';

test('UPGRADES has 4 categories', () => {
  assert.equal(Object.keys(UPGRADES).length, 4);
  ['arena', 'vet_clinic', 'breeding_shed', 'hay_barn'].forEach((id) => {
    assert.ok(UPGRADES[id]);
  });
});

test('each upgrade has 3 levels', () => {
  for (const upgrade of Object.values(UPGRADES)) {
    assert.equal(upgrade.levels.length, 3);
  }
});

test('getUpgradeCost returns null at max level', () => {
  assert.equal(getUpgradeCost('arena', MAX_LEVEL), null);
  assert.equal(getUpgradeCost('arena', 0), 4000);
  assert.equal(getUpgradeCost('arena', 1), 7500);
  assert.equal(getUpgradeCost('arena', 2), 12000);
});

test('getUpgradeLabel returns "Not built" at level 0', () => {
  assert.equal(getUpgradeLabel('arena', 0), 'Not built');
  assert.equal(getUpgradeLabel('arena', 1), 'Open-air ring');
  assert.equal(getUpgradeLabel('arena', 3), 'Championship arena');
});

test('canAffordUpgrade refuses if cash is short', () => {
  const game = makeGame({ cash: 1000 });
  const check = canAffordUpgrade(game, 'arena');
  assert.equal(check.ok, false);
});

test('canAffordUpgrade refuses if at max level', () => {
  const game = makeGame({ cash: 100000, ranchUpgrades: { arena: 3, vet_clinic: 0, breeding_shed: 0, hay_barn: 0 } });
  const check = canAffordUpgrade(game, 'arena');
  assert.equal(check.ok, false);
});

test('canAffordUpgrade allows at level 0 with enough cash', () => {
  const game = makeGame({ cash: 10000 });
  const check = canAffordUpgrade(game, 'arena');
  assert.equal(check.ok, true);
});

test('applyUpgrade deducts cash and increments level', () => {
  const game = makeGame({ cash: 10000 });
  const after = applyUpgrade(game, 'arena');
  assert.equal(after.cash, 10000 - 4000);
  assert.equal(after.ranchUpgrades.arena, 1);
  assert.match(after.log[0], /Upgraded/);
});

test('applyUpgrade refuses at max level', () => {
  const game = makeGame({ cash: 100000, ranchUpgrades: { arena: 3 } });
  assert.throws(() => applyUpgrade(game, 'arena'));
});

test('getRanchEffects reflects all four upgrades', () => {
  const game = makeGame({
    ranchUpgrades: { arena: 2, vet_clinic: 1, breeding_shed: 0, hay_barn: 1 },
  });
  const effects = getRanchEffects(game);
  assert.equal(effects.showBonus, 3);
  assert.equal(effects.trainingBonus, 2);
  assert.equal(effects.vetCost, 2600); // vet_clinic level 1, but using the "0" - 1 = -1 index, need level >=1
  // Actually let me check the logic
  // up.vet_clinic = 1, Math.max(0, 0) = 0, levels[0] = first level
  assert.equal(effects.preventiveCost, 300);
  assert.equal(effects.foalHealthBonus, 0);
  assert.equal(effects.feedDiscount, 0.08);
});

test('applying all four upgrades to level 3 gives full compound effect', () => {
  let game = makeGame({ cash: 200000 });
  game = applyUpgrade(game, 'arena');
  game = applyUpgrade(game, 'vet_clinic');
  game = applyUpgrade(game, 'breeding_shed');
  game = applyUpgrade(game, 'hay_barn');
  // Each was level 0, now level 1. Now apply again to level 2.
  game = applyUpgrade(game, 'arena');
  game = applyUpgrade(game, 'vet_clinic');
  game = applyUpgrade(game, 'breeding_shed');
  game = applyUpgrade(game, 'hay_barn');
  // Apply again to level 3.
  game = applyUpgrade(game, 'arena');
  game = applyUpgrade(game, 'vet_clinic');
  game = applyUpgrade(game, 'breeding_shed');
  game = applyUpgrade(game, 'hay_barn');
  assert.equal(game.ranchUpgrades.arena, 3);
  assert.equal(game.ranchUpgrades.vet_clinic, 3);
  assert.equal(game.ranchUpgrades.breeding_shed, 3);
  assert.equal(game.ranchUpgrades.hay_barn, 3);
  const effects = getRanchEffects(game);
  assert.equal(effects.showBonus, 4.5);
  assert.equal(effects.trainingBonus, 3);
  assert.equal(effects.vetCost, 1300);
  assert.equal(effects.preventiveCost, 100);
  assert.equal(effects.foalHealthBonus, 15);
  assert.equal(effects.feedDiscount, 0.24);
});
