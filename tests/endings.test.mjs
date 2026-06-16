import test from 'node:test';
import assert from 'node:assert/strict';

import { checkEnding, scoreGame, ENDINGS } from '../src/endings.js';
import { makeGame } from './helpers.js';

test('ending fires for dynasty at year 5 with strong legacy', () => {
  const game = makeGame({ day: 605, year: 5, cash: 50000, legacy: 80, reputation: 70, developerPressure: 0 });
  const ending = checkEnding(game);
  assert.ok(ending);
  assert.equal(ending.id, 'dynasty');
});

test('ending fires for bankrupt when cash is deeply negative', () => {
  const game = makeGame({ day: 50, cash: -6000, legacy: 40 });
  const ending = checkEnding(game);
  assert.equal(ending.id, 'bankrupt');
});

test('ending fires for sold-out when crisis resolved as sold', () => {
  const game = makeGame({ day: 50, crisis: { id: 'p', title: 't', description: 'd', resolved: 'sold-to-developer' } });
  const ending = checkEnding(game);
  assert.equal(ending.id, 'sold-out');
});

test('ending fires for quiet-life at year 5 with moderate legacy', () => {
  const game = makeGame({ day: 605, cash: 5000, legacy: 50, reputation: 40, developerPressure: 30 });
  const ending = checkEnding(game);
  assert.equal(ending.id, 'quiet-life');
});

test('scoreGame rewards horses with parents (generations)', () => {
  const game1 = makeGame();
  const game2 = makeGame({
    horses: [
      ...game1.horses,
      { id: 'foal-1', name: 'F', parents: ['blue-ash', 'mercy-road'], value: 5000, age: 0, training: 5, bond: 18, health: 96, stress: 22, injured: false, role: 'foal', bloodline: 'X', temperament: 'X', traits: {}, alive: true },
    ],
  });
  assert.ok(scoreGame(game2) > scoreGame(game1));
});

test('scoreGame rewards more parcels', () => {
  const game1 = makeGame();
  const game2 = makeGame({ parcels: [...game1.parcels, { id: 'p-extra', name: 'X', x: 2, y: 2, forage: 60, water: 60, threat: '—' }] });
  assert.ok(scoreGame(game2) > scoreGame(game1));
});

test('ENDINGS list covers all major narrative outcomes', () => {
  const ids = ENDINGS.map((e) => e.id);
  ['dynasty', 'sold-out', 'bankrupt', 'worn-out', 'fire', 'quiet-life'].forEach((id) => {
    assert.ok(ids.includes(id), `missing ending ${id}`);
  });
});
