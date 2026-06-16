import test from 'node:test';
import assert from 'node:assert/strict';

import { chooseAmbientPreset, listAmbientPresets } from '../src/ambient.js';

// Tests pass season and disaster via options. chooseAmbientPreset reads
// tutorial/day from the game and seasonal/disaster from options.
function gameState(overrides = {}) {
  return {
    day: 30,
    tutorial: { dismissed: true },
    ...overrides,
  };
}

test('chooseAmbientPreset returns off when in tutorial and day <= 10', () => {
  const g = gameState({ day: 5, tutorial: { dismissed: false } });
  assert.equal(chooseAmbientPreset(g), 'off');
  const g2 = gameState({ day: 10, tutorial: { dismissed: false } });
  assert.equal(chooseAmbientPreset(g2), 'off');
});

test('chooseAmbientPreset returns drone after tutorial dismissed (Spring)', () => {
  assert.equal(chooseAmbientPreset(gameState({ day: 30 }), { season: 'Spring' }), 'drone');
});

test('chooseAmbientPreset returns drone in Summer after tutorial', () => {
  assert.equal(chooseAmbientPreset(gameState({ day: 30 }), { season: 'Summer' }), 'drone');
});

test('chooseAmbientPreset returns winter in Winter season', () => {
  assert.equal(chooseAmbientPreset(gameState({ day: 30 }), { season: 'Winter' }), 'winter');
});

test('chooseAmbientPreset returns wind during a blizzard', () => {
  assert.equal(
    chooseAmbientPreset(gameState({ day: 30 }), { season: 'Winter', disaster: 'blizzard' }),
    'wind',
  );
});

test('chooseAmbientPreset returns rain during a flood', () => {
  assert.equal(
    chooseAmbientPreset(gameState({ day: 30 }), { season: 'Spring', disaster: 'flood' }),
    'rain',
  );
});

test('chooseAmbientPreset returns wind during a drought', () => {
  assert.equal(
    chooseAmbientPreset(gameState({ day: 30 }), { season: 'Summer', disaster: 'drought' }),
    'wind',
  );
});

test('chooseAmbientPreset returns off when no season is provided', () => {
  assert.equal(chooseAmbientPreset(gameState({ day: 30 })), 'off');
});

test('chooseAmbientPreset returns off when game is null', () => {
  assert.equal(chooseAmbientPreset(null), 'off');
});

test('listAmbientPresets includes off, wind, rain, drone, winter', () => {
  const presets = listAmbientPresets();
  for (const name of ['off', 'wind', 'rain', 'drone', 'winter']) {
    assert.ok(presets.includes(name), `missing ${name}`);
  }
});
