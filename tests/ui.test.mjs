import test from 'node:test';
import assert from 'node:assert/strict';

import { createNewGame, applyAction } from '../src/game.js';
import {
  buildDashboardModel,
  describeHorse,
  getRanchVerdict,
  formatMoney,
} from '../src/ui.js';

test('formatMoney renders ranch ledger amounts clearly', () => {
  assert.equal(formatMoney(18500), '$18,500');
  assert.equal(formatMoney(-1250), '-$1,250');
});

test('describeHorse creates a compact narrative stat line', () => {
  const horse = createNewGame().horses[0];
  const description = describeHorse(horse);

  assert.match(description, /Blue Ash/);
  assert.match(description, /Reining mare/);
  assert.match(description, /Training 62/);
  assert.match(description, /Bond 46/);
  assert.match(description, /Value \$38,000/);
});

test('dashboard model exposes hero metrics, horses, staff, parcels, and actions for rendering', () => {
  const game = createNewGame();
  const model = buildDashboardModel(game);

  assert.equal(model.title, 'Blood & Bridle');
  assert.equal(model.metrics[0].label, 'Day');
  assert.equal(model.metrics[0].value, '1/30');
  assert.equal(model.metrics[1].value, '$18,500');
  assert.equal(model.horses.length, 5);
  assert.equal(model.actions.some((action) => action.type === 'train'), true);
  assert.equal(model.staff[0], 'Mae Calder · Head trainer · Loyalty 77');
  assert.equal(model.parcels[0], 'West Meadow · Forage 58 · Water 71 · Threat: Resort parcel offer');
});

test('ranch verdict shifts from vulnerable to alive when the player proves the operation', () => {
  const game = createNewGame();
  assert.equal(getRanchVerdict(game), 'Vulnerable legacy: the ranch still has a pulse, but the bank can hear it falter.');

  const wonShow = applyAction({
    ...game,
    cash: 50000,
    legacy: 80,
    reputation: 65,
    horses: game.horses.map((horse) => horse.id === 'blue-ash'
      ? { ...horse, training: 90, bond: 88, health: 95, stress: 10 }
      : horse),
  }, { type: 'enterShow', horseId: 'blue-ash' });

  assert.equal(getRanchVerdict(wonShow), 'Defensible legacy: not safe, never safe, but strong enough to tell the suits no.');
});
