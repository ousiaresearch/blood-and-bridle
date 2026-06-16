import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMap, neighbors, MAP_SIZE, AVAILABLE_PARCELS } from '../src/map.js';
import { buyAvailableParcel } from '../src/game.js';
import { makeGame } from './helpers.js';

test('MAP_SIZE is 4x4', () => {
  assert.equal(MAP_SIZE, 4);
});

test('buildMap places initial parcels in known positions', () => {
  const map = buildMap([
    { id: 'west-meadow', forage: 60, water: 70 },
    { id: 'cedar-draw', forage: 60, water: 50 },
    { id: 'home-place', forage: 70, water: 70 },
  ]);
  assert.ok(map[1][0]);
  assert.equal(map[1][0].id, 'west-meadow');
  assert.ok(map[2][1]);
  assert.equal(map[2][1].id, 'cedar-draw');
  assert.ok(map[1][1]);
  assert.equal(map[1][1].id, 'home-place');
});

test('neighbors returns adjacent parcels only', () => {
  const map = buildMap([
    { id: 'west-meadow', forage: 60, water: 70 },
    { id: 'home-place', forage: 70, water: 70 },
  ]);
  const n = neighbors(map, 1, 1);
  assert.equal(n.length, 1);
  assert.equal(n[0].id, 'west-meadow');
});

test('buyAvailableParcel deducts cash and adds the parcel', () => {
  const parcel = AVAILABLE_PARCELS[0];
  const game = makeGame({ cash: 50000 });
  const after = buyAvailableParcel(game, parcel);
  assert.equal(after.cash, 50000 - parcel.price);
  assert.ok(after.parcels.find((p) => p.id === parcel.id));
});

test('buyAvailableParcel refuses if you do not have the cash', () => {
  const parcel = AVAILABLE_PARCELS[0];
  const game = makeGame({ cash: 100 });
  assert.throws(() => buyAvailableParcel(game, parcel));
});

test('AVAILABLE_PARCELS has at least 3 candidates', () => {
  assert.ok(AVAILABLE_PARCELS.length >= 3);
});
