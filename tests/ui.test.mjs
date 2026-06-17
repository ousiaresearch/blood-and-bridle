import test from 'node:test';
import assert from 'node:assert/strict';

import { createNewGame, applyAction } from '../src/game.js';
import {
  buildDashboardModel,
  describeHorse,
  describeTraits,
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
  assert.match(description, /Campaigner/);
  assert.match(description, /Training 62/);
  assert.match(description, /Bond 46/);
  assert.match(description, /Value \$38,000/);
});

test('describeTraits lists all five inherited trait labels', () => {
  const horse = createNewGame().horses[0];
  const line = describeTraits(horse);
  assert.match(line, /Gait quality/);
  assert.match(line, /Temperament/);
  assert.match(line, /Bone density/);
  assert.match(line, /Heart/);
  assert.match(line, /Conformation/);
});

test('dashboard model exposes hero metrics, horses, staff, parcels, NPCs, rivals, and actions for rendering', () => {
  const game = createNewGame();
  const model = buildDashboardModel(game);

  assert.equal(model.title, 'Blood & Bridle');
  assert.equal(model.metrics[0].label, 'Year');
  assert.equal(model.metrics[2].label, 'Day');
  assert.equal(model.metrics[3].value, '$18,500');
  assert.equal(model.horses.length, 6);
  assert.equal(model.staff.length >= 3, true);
  assert.equal(model.parcels.length, 7);
  assert.equal(model.npcs.length >= 5, true);
  assert.equal(model.rivals.length >= 2, true);
  assert.equal(model.actions.some((action) => action.type === 'train'), true);
});

test('ranch verdict shifts from vulnerable to defensible when the player proves the operation', () => {
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

test('dashboard model surfaces year, season, and day of season in metrics', () => {
  let game = createNewGame();
  for (let i = 0; i < 30; i++) game = applyAction(game, { type: 'rotatePasture' });
  const model = buildDashboardModel(game);
  assert.equal(model.year, 1);
  assert.match(model.season, /Summer/);
  assert.equal(model.dayOfSeason, 1);
});
