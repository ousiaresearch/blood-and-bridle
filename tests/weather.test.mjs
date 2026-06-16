import test from 'node:test';
import assert from 'node:assert/strict';

import { rollDisaster, DISASTERS } from '../src/weather.js';
import { makeGame } from './helpers.js';

test('DISASTERS array has at least one entry per major category', () => {
  const ids = DISASTERS.map((d) => d.id);
  assert.ok(ids.includes('drought'));
  assert.ok(ids.includes('blizzard'));
  assert.ok(ids.includes('barn-fire'));
});

test('rollDisaster returns null or a disaster object', () => {
  for (let day = 1; day < 200; day += 30) {
    const { disaster, game } = rollDisaster(makeGame({ day, parcels: [{ id: 'p', name: 'X', x: 0, y: 0, forage: 60, water: 60, threat: '—' }] }));
    if (disaster) {
      assert.ok(typeof disaster.id === 'string');
      assert.ok(game);
    }
  }
});

test('drought reduces parcel forage', () => {
  const drought = DISASTERS.find((d) => d.id === 'drought');
  const game = makeGame({
    day: 31,
    parcels: [
      { id: 'p1', name: 'A', x: 0, y: 0, forage: 60, water: 60, threat: '—' },
      { id: 'p2', name: 'B', x: 0, y: 0, forage: 70, water: 50, threat: '—' },
    ],
  });
  const after = drought.effect(game);
  assert.ok(after.parcels[0].forage < 60);
  assert.ok(after.parcels[0].water < 60);
});

test('blizzard damages horse health and raises stress', () => {
  const blizzard = DISASTERS.find((d) => d.id === 'blizzard');
  const game = makeGame({
    day: 91,
    horses: makeGame().horses.map((h) => ({ ...h, health: 80, stress: 30 })),
  });
  const after = blizzard.effect(game);
  assert.ok(after.horses[0].health < 80);
  assert.ok(after.horses[0].stress > 30);
});
