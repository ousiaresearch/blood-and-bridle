// Blood & Bridle — parcel system tests.
//
// The contract: 6 named parcels, terrain-driven hazards, improvements cancel
// hazards, total feed capacity sums non-leased non-off-limits parcels.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TERRAIN,
  PARCEL_STATE,
  PARCEL_DEFS,
  IMPROVEMENT_COSTS,
  TERRAIN_HAZARD,
  HAZARD_OUTCOME,
  createInitialParcels,
  addParcel,
  applyParcelImprovement,
  rollParcelHazard,
  applyParcelHazardOutcomes,
  totalFeedCapacity,
  totalAcres,
  totalMonthlyParcelFees,
  findParcel,
  parcelsByTerrain,
  parcelConditionLine,
} from '../src/parcels.js';

test('createInitialParcels returns 6 parcels', () => {
  const parcels = createInitialParcels();
  assert.equal(parcels.length, 6);
});

test('parcel ids are unique', () => {
  const ids = createInitialParcels().map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every parcel has full schema (terrain, state, hazard, improvement, acres, feedCapacity, riskModifier)', () => {
  for (const p of createInitialParcels()) {
    assert.ok(p.id, 'parcel has id');
    assert.ok(p.name, 'parcel has name');
    assert.ok(typeof p.x === 'number' && typeof p.y === 'number', 'parcel has coords');
    assert.ok(typeof p.forage === 'number', 'parcel has forage');
    assert.ok(typeof p.water === 'number', 'parcel has water');
    assert.ok(typeof p.acres === 'number' && p.acres > 0, 'parcel has acres');
    assert.ok(TERRAIN[p.terrain.toUpperCase()] !== undefined, 'parcel has valid terrain');
    assert.equal(p.state, PARCEL_STATE.DEFAULT, 'parcel starts in default state');
    assert.equal(p.improvement, null, 'parcel starts unimproved');
    assert.ok(typeof p.hazard === 'string', 'parcel has hazard');
    assert.ok(typeof p.feedCapacity === 'number', 'parcel has feedCapacity');
    assert.ok(typeof p.riskModifier === 'number' && p.riskModifier >= 0, 'parcel has riskModifier');
  }
});

test('leased parcel: show-grounds has no feed capacity and a monthly fee', () => {
  const show = createInitialParcels().find((p) => p.id === 'show-grounds');
  assert.ok(show.leased, 'show-grounds is leased');
  assert.equal(show.feedCapacity, 0, 'leased parcel has no feed capacity');
  assert.ok(show.monthlyFee > 0, 'leased parcel has a monthly fee');
});

test('off-limits parcel: breeding-shed has zero everything', () => {
  const shed = createInitialParcels().find((p) => p.id === 'breeding-shed');
  assert.ok(shed.offLimits, 'breeding-shed is off-limits');
  assert.equal(shed.feedCapacity, 0);
  assert.equal(shed.forage, 0);
  assert.equal(shed.water, 0);
  assert.equal(shed.hazard, 'none', 'off-limits has no hazard');
});

test('home-place, cedar-draw, north-ridge, back-forty each have non-zero feed capacity', () => {
  const parcels = createInitialParcels();
  const working = parcels.filter((p) => !p.leased && !p.offLimits);
  assert.equal(working.length, 4, 'four non-leased non-off-limits parcels');
  for (const p of working) {
    assert.ok(p.feedCapacity > 0, `${p.name} has feed capacity`);
  }
});

test('terrain drives hazard', () => {
  assert.equal(TERRAIN_HAZARD[TERRAIN.CREEK], 'flood');
  assert.equal(TERRAIN_HAZARD[TERRAIN.RIDGE], 'rock_fall');
  assert.equal(TERRAIN_HAZARD[TERRAIN.SCRUB], 'predator');
  assert.equal(TERRAIN_HAZARD[TERRAIN.PASTURE], 'drought');
  assert.equal(TERRAIN_HAZARD[TERRAIN.LEASED], 'none');
  assert.equal(TERRAIN_HAZARD[TERRAIN.OFF_LIMITS], 'none');
});

test('applyParcelImprovement: drained cancels flood', () => {
  let parcels = createInitialParcels();
  const before = parcels.find((p) => p.id === 'cedar-draw');
  assert.equal(before.hazard, 'flood');
  parcels = applyParcelImprovement(parcels, 'cedar-draw', 'drained', 100000);
  const after = parcels.find((p) => p.id === 'cedar-draw');
  assert.equal(after.improvement, 'drained');
  assert.equal(after.state, 'drained');
  assert.ok(after.riskModifier < before.riskModifier, 'risk modifier decreases');
  assert.ok(after.forage > before.forage, 'forage recovers');
});

test('applyParcelImprovement throws on wrong terrain', () => {
  const parcels = createInitialParcels();
  // home-place is pasture, drain is for creek
  assert.throws(
    () => applyParcelImprovement(parcels, 'home-place', 'drained', 100000),
    /requires creek terrain/,
  );
});

test('applyParcelImprovement throws if already improved', () => {
  let parcels = createInitialParcels();
  parcels = applyParcelImprovement(parcels, 'cedar-draw', 'drained', 100000);
  assert.throws(
    () => applyParcelImprovement(parcels, 'cedar-draw', 'drained', 100000),
    /already improved/,
  );
});

test('applyParcelImprovement throws on insufficient cash', () => {
  const parcels = createInitialParcels();
  assert.throws(
    () => applyParcelImprovement(parcels, 'cedar-draw', 'drained', 100),
    /Need \$/,
  );
});

test('rollParcelHazard returns canceled:true when improvement nullifies hazard', () => {
  let parcels = createInitialParcels();
  parcels = applyParcelImprovement(parcels, 'cedar-draw', 'drained', 100000);
  const creek = parcels.find((p) => p.id === 'cedar-draw');
  // Force a high-severity roll
  const result = rollParcelHazard(creek, 'Spring', 10);
  assert.equal(result.hazard, 'flood');
  assert.equal(result.outcome, null);
  assert.equal(result.canceled, true);
});

test('rollParcelHazard can produce a state outcome when not improved', () => {
  const creek = createInitialParcels().find((p) => p.id === 'cedar-draw');
  // Run many rolls with high severity — at least one should flood
  let flooded = 0;
  for (let i = 0; i < 200; i++) {
    const r = rollParcelHazard(creek, 'Spring', 5);
    if (r.outcome === 'flooded') flooded++;
  }
  assert.ok(flooded > 0, 'at least one high-severity spring roll should flood');
});

test('applyParcelHazardOutcomes updates state on multiple parcels', () => {
  const parcels = createInitialParcels();
  const outcomes = [
    { parcelId: 'cedar-draw', hazard: 'flood', outcome: 'flooded' },
    { parcelId: 'back-forty', hazard: 'predator', outcome: 'coyote_infestation' },
  ];
  const next = applyParcelHazardOutcomes(parcels, outcomes);
  assert.equal(next.find((p) => p.id === 'cedar-draw').state, 'flooded');
  assert.equal(next.find((p) => p.id === 'back-forty').state, 'coyote_infestation');
});

test('totalFeedCapacity sums non-leased non-off-limits parcels only', () => {
  const parcels = createInitialParcels();
  const total = totalFeedCapacity(parcels);
  const expected = parcels.filter((p) => !p.leased && !p.offLimits).reduce((s, p) => s + p.feedCapacity, 0);
  assert.equal(total, expected);
  assert.ok(total > 0, 'ranch can sustain horses on its own hay');
});

test('totalAcres excludes leased and off-limits', () => {
  const parcels = createInitialParcels();
  const total = totalAcres(parcels);
  const expected = parcels.filter((p) => !p.leased && !p.offLimits).reduce((s, p) => s + p.acres, 0);
  assert.equal(total, expected);
});

test('totalMonthlyParcelFees sums leased parcels only', () => {
  const parcels = createInitialParcels();
  const total = totalMonthlyParcelFees(parcels);
  const expected = parcels.filter((p) => p.leased).reduce((s, p) => s + (p.monthlyFee ?? 0), 0);
  assert.equal(total, expected);
  assert.ok(total > 0, 'show grounds has a fee');
});

test('findParcel throws on missing id', () => {
  assert.throws(() => findParcel(createInitialParcels(), 'nope'), /not found/);
});

test('parcelsByTerrain groups correctly', () => {
  const groups = parcelsByTerrain(createInitialParcels());
  assert.ok(groups[TERRAIN.CREEK].length >= 1);
  assert.ok(groups[TERRAIN.PASTURE].length >= 1);
  assert.ok(groups[TERRAIN.RIDGE].length >= 1);
  assert.ok(groups[TERRAIN.SCRUB].length >= 1);
  assert.ok(groups[TERRAIN.LEASED].length >= 1);
  assert.ok(groups[TERRAIN.OFF_LIMITS].length >= 1);
});

test('parcelConditionLine returns null for default state', () => {
  const home = createInitialParcels().find((p) => p.id === 'home-place');
  assert.equal(parcelConditionLine(home), null);
});

test('parcelConditionLine returns improvement line for improved parcel', () => {
  let parcels = createInitialParcels();
  parcels = applyParcelImprovement(parcels, 'cedar-draw', 'drained', 100000);
  const line = parcelConditionLine(parcels.find((p) => p.id === 'cedar-draw'));
  assert.ok(line.includes('Cedar Draw'));
  assert.ok(line.includes('ditch') || line.includes('creek'));
});

test('parcelConditionLine returns hazard line for hazard-state parcel', () => {
  let parcels = createInitialParcels();
  parcels = parcels.map((p) => p.id === 'cedar-draw' ? { ...p, state: 'flooded' } : p);
  const line = parcelConditionLine(parcels.find((p) => p.id === 'cedar-draw'));
  assert.ok(line.includes('under water') || line.includes('creek took'));
});

test('addParcel: parcel def with full schema is added to array', () => {
  const parcels = createInitialParcels();
  const newDef = {
    id: 'south-bottoms',
    name: 'South Bottoms',
    x: 2, y: 1,
    acres: 200,
    baseForage: 60,
    baseWater: 70,
    baseFeedCapacity: 10,
    riskModifier: 0.9,
    threat: 'River bottom, river takes it',
    terrain: TERRAIN.CREEK,
  };
  const next = addParcel(parcels, newDef);
  assert.equal(next.length, parcels.length + 1);
  const added = next.find((p) => p.id === 'south-bottoms');
  assert.equal(added.terrain, TERRAIN.CREEK);
  assert.equal(added.hazard, 'flood');
  assert.equal(added.improvement, null);
});

test('addParcel throws on duplicate id', () => {
  const parcels = createInitialParcels();
  const dupDef = { ...PARCEL_DEFS[0] };
  assert.throws(() => addParcel(parcels, dupDef), /already owned/);
});

test('IMPROVEMENT_COSTS: every improvement has cash + laborHours + terrain', () => {
  for (const [key, def] of Object.entries(IMPROVEMENT_COSTS)) {
    assert.ok(typeof def.cash === 'number' && def.cash > 0, `${key} has cash cost`);
    assert.ok(typeof def.laborHours === 'number' && def.laborHours > 0, `${key} has labor cost`);
    assert.ok(TERRAIN[def.terrain.toUpperCase()] !== undefined, `${key} has valid terrain`);
    assert.ok(typeof def.label === 'string' && def.label.length > 0, `${key} has label`);
  }
});

test('HAZARD_OUTCOME: every hazard has state + canceledBy', () => {
  for (const [key, def] of Object.entries(HAZARD_OUTCOME)) {
    assert.ok(typeof def.state === 'string' || def.state === null, `${key} has state`);
    assert.ok(typeof def.canceledBy === 'string' || def.canceledBy === null, `${key} has canceledBy`);
  }
});
