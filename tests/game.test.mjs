import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createNewGame,
  applyAction,
  getActiveCrisis,
  getAvailableActions,
  getGameSummary,
  isGameOver,
} from '../src/game.js';

test('new game opens with a strained legacy ranch and named horses', () => {
  const game = createNewGame();

  assert.equal(game.day, 1);
  assert.equal(game.cash, 18500);
  assert.equal(game.legacy, 62);
  assert.equal(game.horses.length, 5);
  assert.deepEqual(game.horses.map((horse) => horse.name), [
    'Blue Ash',
    'Mercy Road',
    'Juniper Smoke',
    'Red Ledger',
    'Sunday Caller',
  ]);
  assert.equal(game.horses[0].bond, 46);
  assert.equal(game.staff[0].name, 'Mae Calder');
  assert.equal(getActiveCrisis(game).title, 'Thirty Days to Prove the Ranch');
});

test('training a horse improves discipline and bond while costing cash and time', () => {
  const game = createNewGame();
  const next = applyAction(game, { type: 'train', horseId: 'blue-ash', staffId: 'mae' });
  const blueAsh = next.horses.find((horse) => horse.id === 'blue-ash');

  assert.equal(next.day, 2);
  assert.equal(next.cash, 17680); // training + daily feed burn
  assert.equal(blueAsh.training, 68);
  assert.equal(blueAsh.bond, 52);
  assert.equal(blueAsh.stress, 26);
  assert.match(next.log[0], /Mae Calder worked Blue Ash/);
});

test('rotating pasture lowers stress and improves land health but delays show readiness', () => {
  const game = createNewGame();
  const stressed = {
    ...game,
    horses: game.horses.map((horse) => ({ ...horse, stress: 70 })),
    parcels: game.parcels.map((parcel) => ({ ...parcel, forage: 42 })),
  };

  const next = applyAction(stressed, { type: 'rotatePasture' });

  assert.equal(next.day, 2);
  assert.equal(next.horses[0].stress, 58);
  assert.equal(next.parcels[0].forage, 50);
  assert.equal(next.parcels[1].forage, 50);
  assert.match(next.log[0], /Rotated the herd/);
});

test('vet care removes injury flags and protects reputation at a significant cost', () => {
  const game = createNewGame();
  const hurt = {
    ...game,
    horses: game.horses.map((horse) => horse.id === 'mercy-road' ? { ...horse, injured: true, health: 44 } : horse),
  };

  const next = applyAction(hurt, { type: 'vetCare', horseId: 'mercy-road' });
  const mercy = next.horses.find((horse) => horse.id === 'mercy-road');

  assert.equal(next.cash, 15100); // 2600 vet + 800 daily burn
  assert.equal(mercy.injured, false);
  assert.equal(mercy.health, 72);
  assert.equal(next.reputation, 41);
});

test('selling a top horse stabilizes cash but damages legacy and staff loyalty', () => {
  const game = createNewGame();
  const next = applyAction(game, { type: 'sellHorse', horseId: 'blue-ash' });

  assert.equal(next.cash, 55700); // 38000 sale - 800 daily burn
  assert.equal(next.legacy, 50);
  assert.equal(next.horses.some((horse) => horse.id === 'blue-ash'), false);
  assert.equal(next.staff[0].loyalty, 65);
  assert.match(next.log[0], /Sold Blue Ash/);
});

test('show entry pays winnings when readiness clears the pressure threshold', () => {
  const game = createNewGame();
  const ready = {
    ...game,
    horses: game.horses.map((horse) => horse.id === 'blue-ash'
      ? { ...horse, training: 86, bond: 82, health: 91, stress: 18 }
      : horse),
  };

  const next = applyAction(ready, { type: 'enterShow', horseId: 'blue-ash' });

  assert.equal(next.cash, 23700); // +6000 winnings - 800 burn
  assert.equal(next.reputation, 50);
  assert.equal(next.legacy, 65);
  assert.match(next.log[0], /Blue Ash placed at the invitational/);
});

test('developer offer can be refused for legacy at the cost of pressure and immediate money', () => {
  const game = createNewGame();
  const next = applyAction(game, { type: 'refuseDeveloper' });

  assert.equal(next.cash, 17700);
  assert.equal(next.legacy, 71);
  assert.equal(next.developerPressure, 62);
  assert.match(next.log[0], /Refused the resort parcel offer/);
});

test('available actions change when cash and roster collapse', () => {
  const game = { ...createNewGame(), cash: 200, horses: [createNewGame().horses[0]] };
  const actionTypes = getAvailableActions(game).map((action) => action.type);

  assert.equal(actionTypes.includes('vetCare'), false);
  assert.equal(actionTypes.includes('sellHorse'), false);
  assert.equal(actionTypes.includes('train'), true);
});

test('summary and game over describe a playable 30 day MVP scenario', () => {
  const game = createNewGame();
  const summary = getGameSummary(game);

  assert.match(summary, /Day 1\/30/);
  assert.match(summary, /Cash \$18,500/);
  assert.equal(isGameOver({ ...game, day: 31 }), true);
  assert.equal(isGameOver({ ...game, cash: -1000 }), true);
  assert.equal(isGameOver({ ...game, legacy: 0 }), true);
  assert.equal(isGameOver(game), false);
});
