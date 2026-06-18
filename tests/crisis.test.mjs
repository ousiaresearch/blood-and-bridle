// Blood & Bridle — crisis + endings + heir tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CRISIS_TYPES,
  CRISIS_DEFS,
  createCrisis,
  resolveCrisis,
  detectCrisisTriggers,
  pickCrisisToFire,
} from '../src/crisis.js';
import {
  ENDINGS,
  checkEnding,
  checkCornerEnding,
} from '../src/endings.js';
import {
  buildHeir,
  applyHeirTransition,
  generationalNarrative,
} from '../src/heir.js';

test('CRISIS_TYPES has 8 crisis types', () => {
  assert.equal(Object.keys(CRISIS_TYPES).length, 8);
});

test('CRISIS_DEFS has a definition for every type', () => {
  for (const t of Object.values(CRISIS_TYPES)) {
    assert.ok(CRISIS_DEFS[t], `${t} has a definition`);
    assert.ok(CRISIS_DEFS[t].options.length >= 2);
  }
});

test('createCrisis throws on unknown type', () => {
  assert.throws(() => createCrisis('unknown', 1), /Unknown crisis type/);
});

test('createCrisis returns a crisis event with options', () => {
  const c = createCrisis(CRISIS_TYPES.FIRE, 30);
  assert.equal(c.type, CRISIS_TYPES.FIRE);
  assert.equal(c.options.length, 3);
  assert.equal(c.resolved, false);
});

test('resolveCrisis applies cash and legacy effects', () => {
  const c = createCrisis(CRISIS_TYPES.FIRE, 30);
  const game = { cash: 5000, legacy: 60, horses: [{ id: 'h1' }, { id: 'h2' }] };
  const result = resolveCrisis(c, 0, game); // "Save the horses"
  // Option 0: cash -2500, legacy -3
  assert.equal(result.game.cash, 2500);
  assert.equal(result.game.legacy, 57);
});

test('resolveCrisis returns corner deltas', () => {
  const c = createCrisis(CRISIS_TYPES.FIRE, 30);
  const result = resolveCrisis(c, 0, { cash: 5000, legacy: 60, horses: [] });
  assert.equal(result.cornerDeltas.horsemen, 5);
});

test('resolveCrisis throws on invalid option index', () => {
  const c = createCrisis(CRISIS_TYPES.FIRE, 30);
  assert.throws(() => resolveCrisis(c, 99, { cash: 5000, legacy: 60 }), /Invalid crisis option/);
});

test('detectCrisisTriggers: high horse count + low crew = broken leg risk', () => {
  const game = {
    horses: Array.from({ length: 10 }, (_, i) => ({ id: `h${i}` })),
    reputationCorners: { crew: 30, horsemen: 50, country: 50, bank: 50 },
    insuranceEnabled: true,
    parcels: [],
  };
  const triggers = detectCrisisTriggers(game);
  const types = triggers.map((t) => t.type);
  assert.ok(types.includes(CRISIS_TYPES.BROKEN_LEG), `should detect broken leg risk (got ${types})`);
});

test('detectCrisisTriggers: no insurance = fire risk', () => {
  const game = {
    horses: [],
    reputationCorners: { crew: 50, horsemen: 50, country: 50, bank: 50 },
    insuranceEnabled: false,
    parcels: [],
  };
  const triggers = detectCrisisTriggers(game);
  const types = triggers.map((t) => t.type);
  assert.ok(types.includes(CRISIS_TYPES.FIRE));
});

test('detectCrisisTriggers: low bank = late frost risk', () => {
  const game = {
    horses: [],
    reputationCorners: { crew: 50, horsemen: 50, country: 50, bank: 10 },
    insuranceEnabled: true,
    parcels: [],
  };
  const triggers = detectCrisisTriggers(game);
  const types = triggers.map((t) => t.type);
  assert.ok(types.includes(CRISIS_TYPES.LATE_FROST));
});

test('pickCrisisToFire returns null when no triggers', () => {
  const result = pickCrisisToFire([], 30, () => 0);
  assert.equal(result, null);
});

test('pickCrisisToFire fires when random < chance', () => {
  const triggers = [{ type: CRISIS_TYPES.FIRE, chance: 1.0 }];
  const result = pickCrisisToFire(triggers, 30, () => 0);
  assert.ok(result);
  assert.equal(result.type, CRISIS_TYPES.FIRE);
});

test('ENDINGS has the four corner-collapse endings', () => {
  const ids = ENDINGS.map((e) => e.id);
  assert.ok(ids.includes('horsemen-collapse'));
  assert.ok(ids.includes('country-collapse'));
  assert.ok(ids.includes('bank-collapse'));
  assert.ok(ids.includes('crew-collapse'));
});

test('ENDINGS has the insolvency and foreclosure endings', () => {
  const ids = ENDINGS.map((e) => e.id);
  assert.ok(ids.includes('insolvency'));
  assert.ok(ids.includes('foreclosure'));
});

test('checkEnding fires horsemen-collapse at 3 seasons', () => {
  const game = { collapsedCornerSeasons: { horsemen: 3 } };
  const ending = checkEnding(game);
  assert.equal(ending.id, 'horsemen-collapse');
});

test('checkEnding fires country-collapse at 3 seasons', () => {
  const game = { collapsedCornerSeasons: { country: 3 } };
  const ending = checkEnding(game);
  assert.equal(ending.id, 'country-collapse');
});

test('checkCornerEnding returns null when no corner collapsed', () => {
  const game = { collapsedCornerSeasons: {} };
  assert.equal(checkCornerEnding(game), null);
});

test('checkCornerEnding identifies the bank collapse', () => {
  const game = { collapsedCornerSeasons: { bank: 3 } };
  const result = checkCornerEnding(game);
  assert.equal(result.corner, 'bank');
});

test('buildHeir: picks Mae when working', () => {
  const game = {
    hands: [
      { id: 'mae', status: 'working', name: 'Mae Calder', morale: 70 },
      { id: 'eli', status: 'working', name: 'Eli Rusk', morale: 60 },
    ],
  };
  const result = buildHeir(game);
  assert.equal(result.heir.id, 'mae');
  assert.ok(result.narrative.includes('Mae'));
});

test('buildHeir: picks Eli when Mae is gone', () => {
  const game = {
    hands: [
      { id: 'mae', status: 'gone', name: 'Mae' },
      { id: 'eli', status: 'working', name: 'Eli' },
    ],
  };
  const result = buildHeir(game);
  assert.equal(result.heir.id, 'eli');
});

test('buildHeir: returns null heir when no working hands', () => {
  const game = { hands: [{ id: 'mae', status: 'gone', name: 'Mae' }] };
  const result = buildHeir(game);
  assert.equal(result.heir, null);
});

test('buildHeir: returns transition damage', () => {
  const game = {
    hands: [{ id: 'mae', status: 'working', name: 'Mae' }],
  };
  const result = buildHeir(game);
  assert.ok(result.transitionDamage.country < 0);
  assert.ok(result.transitionDamage.crew < 0);
});

test('applyHeirTransition: day-workers do not transfer', () => {
  const game = {
    hands: [{ id: 'mae', status: 'working', name: 'Mae', morale: 70 }],
    dayWorkers: [{ id: 'the-kid', name: 'Tucker' }, { id: 'the-old-timer', name: 'Harlan' }],
    reputationCorners: { horsemen: 60, country: 50, bank: 50, crew: 60 },
    log: [],
  };
  const next = applyHeirTransition(game);
  assert.equal(next.dayWorkers.length, 0, 'day-workers do not transfer');
});

test('applyHeirTransition: country corner takes a hit', () => {
  const game = {
    hands: [{ id: 'mae', status: 'working', name: 'Mae', morale: 70 }],
    dayWorkers: [],
    reputationCorners: { horsemen: 60, country: 50, bank: 50, crew: 60 },
    log: [],
  };
  const next = applyHeirTransition(game);
  assert.ok(next.reputationCorners.country < 50);
});

test('applyHeirTransition: increments generation count', () => {
  const game = {
    hands: [{ id: 'mae', status: 'working', name: 'Mae', morale: 70 }],
    dayWorkers: [],
    reputationCorners: { horsemen: 60, country: 50, bank: 50, crew: 60 },
    log: [],
    generationCount: 1,
  };
  const next = applyHeirTransition(game);
  assert.equal(next.generationCount, 2);
});

test('generationalNarrative: first generation', () => {
  const game = { generationCount: 1 };
  const narrative = generationalNarrative(game);
  assert.ok(narrative.includes('first generation'));
});

test('generationalNarrative: third generation', () => {
  const game = { generationCount: 3 };
  const narrative = generationalNarrative(game);
  assert.ok(narrative.includes('3rd generation') || narrative.includes('3 generation'));
});