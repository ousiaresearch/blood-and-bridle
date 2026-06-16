import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLineageModel, getParents, getOffspring, getAncestors } from '../src/lineage.js';
import { makeGame } from './helpers.js';

test('buildLineageModel returns null for unknown horse', () => {
  assert.equal(buildLineageModel(makeGame(), 'ghost'), null);
});

test('buildLineageModel surfaces parents and offspring', () => {
  const game = makeGame();
  const foal = { id: 'foal-1', name: 'Filly', parents: ['blue-ash', 'mercy-road'], age: 1, value: 5000 };
  game.horses = [...game.horses, foal];
  const model = buildLineageModel(game, 'foal-1');
  assert.equal(model.parents.length, 2);
  assert.equal(model.parents[0].name, 'Blue Ash');
  assert.equal(model.parents[1].name, 'Mercy Road');
});

test('getOffspring returns horses that list this horse as a parent', () => {
  const game = makeGame();
  const foal = { id: 'foal-1', name: 'Filly', parents: ['blue-ash'], age: 0, value: 4500 };
  game.horses = [...game.horses, foal];
  const offspring = getOffspring(game, 'blue-ash');
  assert.equal(offspring.length, 1);
  assert.equal(offspring[0].id, 'foal-1');
});

test('getAncestors walks the family tree up to depth', () => {
  const game = makeGame();
  const grandparent = { id: 'g1', name: 'GP', parents: [], age: 14, value: 20000 };
  const parent = { id: 'p1', name: 'P', parents: ['g1'], age: 8, value: 25000 };
  const child = { id: 'c1', name: 'C', parents: ['p1'], age: 2, value: 8000 };
  game.horses = [...game.horses, grandparent, parent, child];
  const ancestors = getAncestors(game, 'c1', 3);
  assert.ok(ancestors.find((a) => a.id === 'p1'));
  assert.ok(ancestors.find((a) => a.id === 'g1'));
});

test('getParents returns empty for orphan horse', () => {
  const game = makeGame();
  assert.deepEqual(getParents(game.horses[0]), []);
});
