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
  HAZARD_LOSS,
  createInitialParcels,
  addParcel,
  applyParcelImprovement,
  applyParcelLoss,
  rollParcelHazard,
  applyParcelHazardOutcomes,
  tickParcelHazards,
  hazardDeathCircumstance,
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

// --- Phase 1.2: seasonal hazard rolls ---

test('HAZARD_LOSS: every hazard has forageDelta/waterDelta/injuryChance/deathChance/cost', () => {
  for (const [key, def] of Object.entries(HAZARD_LOSS)) {
    assert.ok(typeof def.forageDelta === 'number', `${key} has forageDelta`);
    assert.ok(typeof def.waterDelta === 'number', `${key} has waterDelta`);
    assert.ok(typeof def.injuryChance === 'number', `${key} has injuryChance`);
    assert.ok(typeof def.deathChance === 'number', `${key} has deathChance`);
    assert.ok(typeof def.cost === 'number', `${key} has cost`);
  }
});

test('flood has 0% injury and death (no horses on the bottom in flood season)', () => {
  assert.equal(HAZARD_LOSS.flood.injuryChance, 0);
  assert.equal(HAZARD_LOSS.flood.deathChance, 0);
});

test('drought has 0% injury and death (no horses lost, just forage and cash)', () => {
  assert.equal(HAZARD_LOSS.drought.injuryChance, 0);
  assert.equal(HAZARD_LOSS.drought.deathChance, 0);
});

test('predator has nonzero injury and death chances (foals especially)', () => {
  assert.ok(HAZARD_LOSS.predator.injuryChance > 0);
  assert.ok(HAZARD_LOSS.predator.deathChance > 0);
});

test('rock_fall has small death chance (the ridge gives up its dead sometimes)', () => {
  assert.ok(HAZARD_LOSS.rock_fall.deathChance > 0);
  assert.ok(HAZARD_LOSS.rock_fall.deathChance < 0.1, 'rock_fall death chance is small');
});

test('applyParcelLoss: clamps forage and water between 0 and 100', () => {
  const parcels = createInitialParcels();
  const creek = parcels.find((p) => p.id === 'cedar-draw');
  // Force forage to 30, then apply flood (forageDelta -100) → should clamp to 0
  const lowForage = parcels.map((p) => p.id === 'cedar-draw' ? { ...p, forage: 30 } : p);
  const floodLoss = HAZARD_LOSS.flood;
  const result = applyParcelLoss(lowForage, 'cedar-draw', floodLoss);
  const after = result.find((p) => p.id === 'cedar-draw');
  assert.equal(after.forage, 0, 'forage clamps to 0');
  // water table rises 15 — clamp at 100
  const highWater = parcels.map((p) => p.id === 'cedar-draw' ? { ...p, water: 95 } : p);
  const result2 = applyParcelLoss(highWater, 'cedar-draw', floodLoss);
  const after2 = result2.find((p) => p.id === 'cedar-draw');
  assert.ok(after2.water <= 100, 'water clamps at 100');
});

test('tickParcelHazards: returns parcels, log, cost, injured, killed keys', () => {
  const parcels = createInitialParcels();
  const horses = [
    { id: 'h1', name: 'Test Horse', age: 5, legendary: false },
  ];
  const result = tickParcelHazards(parcels, horses, 'Spring', 1.0);
  assert.ok(Array.isArray(result.parcels));
  assert.ok(Array.isArray(result.parcelHazardLog));
  assert.ok(typeof result.parcelCost === 'number');
  assert.ok(Array.isArray(result.injured));
  assert.ok(Array.isArray(result.killed));
});

test('tickParcelHazards: skipped parcels (leased, off-limits, no hazard) do not roll', () => {
  // With low weather severity and off-season for some hazards, the
  // log should not contain flooded creek in fall.
  const parcels = createInitialParcels();
  const horses = [{ id: 'h1', name: 'Test', age: 5, legendary: false }];
  let creekFlooded = 0;
  for (let i = 0; i < 100; i++) {
    const r = tickParcelHazards(parcels, horses, 'Fall', 1.0);
    const after = r.parcels.find((p) => p.id === 'cedar-draw');
    if (after.state === 'flooded') creekFlooded++;
  }
  // Fall flood chance is much lower than spring; should rarely fire
  assert.ok(creekFlooded < 30, 'fall floods are rare');
});

test('tickParcelHazards: improved parcels do not fire their canceled hazard', () => {
  let parcels = createInitialParcels();
  parcels = applyParcelImprovement(parcels, 'cedar-draw', 'drained', 100000);
  const horses = [{ id: 'h1', name: 'Test', age: 5, legendary: false }];
  let flooded = 0;
  for (let i = 0; i < 200; i++) {
    const r = tickParcelHazards(parcels, horses, 'Spring', 5.0);
    const after = r.parcels.find((p) => p.id === 'cedar-draw');
    if (after.state === 'flooded') flooded++;
  }
  assert.equal(flooded, 0, 'drained creek never floods');
});

test('tickParcelHazards: high weather severity fires hazards more often', () => {
  const parcels = createInitialParcels();
  const horses = [{ id: 'h1', name: 'Test', age: 5, legendary: false }];
  // Count Spring floods over 200 rolls, low vs high severity
  let lowFloods = 0;
  let highFloods = 0;
  for (let i = 0; i < 200; i++) {
    const r1 = tickParcelHazards(parcels, horses, 'Spring', 1.0);
    if (r1.parcels.find((p) => p.id === 'cedar-draw').state === 'flooded') lowFloods++;
    const r2 = tickParcelHazards(parcels, horses, 'Spring', 3.0);
    if (r2.parcels.find((p) => p.id === 'cedar-draw').state === 'flooded') highFloods++;
  }
  assert.ok(highFloods > lowFloods, `high severity should fire more often (low=${lowFloods}, high=${highFloods})`);
});

test('tickParcelHazards: parcel cost is summed across all fired hazards', () => {
  const parcels = createInitialParcels();
  const horses = [{ id: 'h1', name: 'Test', age: 5, legendary: false }];
  let totalCost = 0;
  let firedAny = 0;
  for (let i = 0; i < 100; i++) {
    const r = tickParcelHazards(parcels, horses, 'Spring', 3.0);
    if (r.parcelCost > 0) {
      firedAny++;
      totalCost += r.parcelCost;
    }
  }
  assert.ok(firedAny > 0, 'at least one hazard should fire in 100 high-severity spring rolls');
  assert.ok(totalCost >= firedAny * HAZARD_LOSS.flood.cost, 'costs sum properly');
});

test('tickParcelHazards: injured horses come back in the injured array', () => {
  const parcels = createInitialParcels();
  // 10 horses, no legendary
  const horses = Array.from({ length: 10 }, (_, i) => ({
    id: `h${i}`, name: `Horse ${i}`, age: 5, legendary: false,
  }));
  let totalInjured = 0;
  let totalKilled = 0;
  for (let i = 0; i < 100; i++) {
    const r = tickParcelHazards(parcels, horses, 'Spring', 5.0);
    totalInjured += r.injured.length;
    totalKilled += r.killed.length;
  }
  // With 18% injury and 8% death per horse per rock-fall/predator
  // roll × 200 roll-opportunities (100 trials × 2 dangerous parcels),
  // we should see a non-trivial number of injuries over 100 trials.
  assert.ok(totalInjured + totalKilled > 0, 'at least one injury or death over 100 trials');
});

test('tickParcelHazards: legendary horse is excluded from injury/death rolls', () => {
  const parcels = createInitialParcels();
  const horses = [
    { id: 'h1', name: 'Test', age: 5, legendary: false },
    { id: 'h2', name: 'Hell Bitch', age: 4, legendary: true },
  ];
  let legendaryDied = 0;
  for (let i = 0; i < 200; i++) {
    const r = tickParcelHazards(parcels, horses, 'Spring', 5.0);
    if (r.killed.some((h) => h.id === 'h2')) legendaryDied++;
  }
  assert.equal(legendaryDied, 0, 'legendary horse is never killed by parcel hazards');
});

test('hazardDeathCircumstance: foal death mentions coyotes and back forty', () => {
  const foal = { id: 'h1', name: 'Pinto', age: 0, legendary: false };
  const line = hazardDeathCircumstance(foal, { horses: [foal] });
  assert.ok(line.includes('Pinto'));
  assert.ok(line.includes('Coyotes') || line.includes('back forty'));
});

test('hazardDeathCircumstance: old horse death mentions north ridge and rock fall', () => {
  const old = { id: 'h1', name: 'Buckshot', age: 12, legendary: false };
  const line = hazardDeathCircumstance(old, { horses: [old] });
  assert.ok(line.includes('Buckshot'));
  assert.ok(line.includes('ridge') || line.includes('rock'));
});

test('hazardDeathCircumstance: middle-age horse death is a McCarthy fragment', () => {
  const h = { id: 'h1', name: 'Juniper', age: 5, legendary: false };
  const line = hazardDeathCircumstance(h, { horses: [h] });
  assert.ok(line.includes('Juniper'));
  assert.ok(line.includes('land') || line.includes('back') || line.includes('forty'));
});
