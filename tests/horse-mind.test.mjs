// Blood & Bridle — horse mind + breeding cycle tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUIRKS,
  QUIRK_LABELS,
  createInitialAffinity,
  createInitialMemory,
  generateQuirks,
  applyHorseMemory,
  horseTrustIn,
  horseRefusesHand,
  horseMood,
  describeQuirks,
  portraitHint,
} from '../src/horse-mind.js';
import {
  MARE_STATE,
  STALLION_STATE,
  BREEDING_SEASONS,
  GESTATION_DAYS,
  createPregnancy,
  advancePregnancies,
  pregnancyCost,
  isMareUnavailable,
  canStallionBreed,
  geldColt,
  oldHorseDecision,
  generateFoal,
  broodmareSeasonCost,
} from '../src/breeding-cycle.js';

test('QUIRKS has 9 quirks', () => {
  assert.equal(QUIRKS.length, 9);
});

test('QUIRK_LABELS has a label for every quirk', () => {
  for (const q of QUIRKS) {
    assert.ok(QUIRK_LABELS[q]);
  }
});

test('createInitialAffinity returns 0 for each hand', () => {
  const aff = createInitialAffinity();
  for (const v of Object.values(aff)) {
    assert.equal(v, 0);
  }
});

test('createInitialMemory returns empty array', () => {
  assert.deepEqual(createInitialMemory(), []);
});

test('generateQuirks returns 1-2 quirks', () => {
  const quirks = generateQuirks(() => 0.5);
  assert.ok(quirks.length >= 1 && quirks.length <= 2);
});

test('generateQuirks returns valid quirk ids', () => {
  const quirks = generateQuirks(() => 0.5);
  for (const q of quirks) {
    assert.ok(QUIRKS.includes(q));
  }
});

test('applyHorseMemory: trained_well increases affinity', () => {
  const horse = { name: 'Test', affinity: createInitialAffinity(), memory: [] };
  const after = applyHorseMemory(horse, 'trained_well', 'mae');
  assert.equal(after.affinity.mae, 3);
});

test('applyHorseMemory: trained_rough decreases affinity', () => {
  const horse = { name: 'Test', affinity: createInitialAffinity(), memory: [] };
  const after = applyHorseMemory(horse, 'trained_rough', 'mae');
  assert.equal(after.affinity.mae, -8);
});

test('applyHorseMemory: saved_from_hazard increases affinity', () => {
  const horse = { name: 'Test', affinity: createInitialAffinity(), memory: [] };
  const after = applyHorseMemory(horse, 'saved_from_hazard', 'mae');
  assert.equal(after.affinity.mae, 12);
});

test('applyHorseMemory: stores memory entries', () => {
  const horse = { name: 'Test', affinity: createInitialAffinity(), memory: [] };
  const after = applyHorseMemory(horse, 'trained_well', 'mae');
  assert.equal(after.memory.length, 1);
  assert.equal(after.memory[0].event, 'trained_well');
});

test('horseTrustIn: 0 affinity = 50 trust', () => {
  const horse = { affinity: { mae: 0 } };
  assert.equal(horseTrustIn(horse, 'mae'), 50);
});

test('horseTrustIn: 100 affinity = 100 trust', () => {
  const horse = { affinity: { mae: 100 } };
  assert.equal(horseTrustIn(horse, 'mae'), 100);
});

test('horseTrustIn: -100 affinity = 0 trust', () => {
  const horse = { affinity: { mae: -100 } };
  assert.equal(horseTrustIn(horse, 'mae'), 0);
});

test('horseRefusesHand: trusts at 50%, does not refuse', () => {
  const horse = { affinity: { mae: 0 } };
  assert.equal(horseRefusesHand(horse, 'mae'), false);
});

test('horseRefusesHand: low trust = refusal', () => {
  const horse = { affinity: { mae: -80 } };
  assert.equal(horseRefusesHand(horse, 'mae'), true);
});

test('horseMood: calm at default', () => {
  const horse = { memory: [], bond: 50, stress: 20 };
  assert.equal(horseMood(horse), 'calm');
});

test('horseMood: bonded at high bond', () => {
  const horse = { memory: [], bond: 90, stress: 20 };
  assert.equal(horseMood(horse), 'bonded');
});

test('horseMood: broken with recent negative events', () => {
  const horse = { memory: [
    { event: 'trained_rough', severity: 3 },
    { event: 'left_out_storm', severity: 3 },
    { event: 'fed_warm', severity: 1 },
  ], bond: 30, stress: 40 };
  assert.equal(horseMood(horse), 'broken');
});

test('describeQuirks: returns a line for horse with quirks', () => {
  const horse = { name: 'Pinto', quirks: ['wont_load'] };
  const line = describeQuirks(horse);
  assert.ok(line.includes('Pinto'));
  assert.ok(line.includes('Wont load') || line.includes('load'));
});

test('describeQuirks: returns a line for horse with no quirks', () => {
  const horse = { name: 'Steady', quirks: [] };
  const line = describeQuirks(horse);
  assert.ok(line.includes('Steady'));
});

test('portraitHint: returns a valid mood', () => {
  const horse = { memory: [], bond: 50, stress: 20, quirks: [] };
  const hint = portraitHint(horse);
  assert.ok(['calm', 'anxious', 'spooked', 'bonded', 'proud', 'intense'].includes(hint));
});

test('BREEDING_SEASONS is Spring only', () => {
  assert.deepEqual([...BREEDING_SEASONS], ['Spring']);
});

test('GESTATION_DAYS is 340', () => {
  assert.equal(GESTATION_DAYS, 340);
});

test('createPregnancy returns a BRED state', () => {
  const p = createPregnancy('sire1', 'dam1', 30);
  assert.equal(p.state, MARE_STATE.BRED);
  assert.equal(p.dueDay, 30 + GESTATION_DAYS);
});

test('advancePregnancies: BRED → PREGNANT after 30 days', () => {
  const p = createPregnancy('s1', 'd1', 30);
  const advanced = advancePregnancies([p], 70);
  assert.equal(advanced[0].state, MARE_STATE.PREGNANT);
});

test('advancePregnancies: PREGNANT → FOALED on due day', () => {
  const p = { ...createPregnancy('s1', 'd1', 30), state: MARE_STATE.PREGNANT };
  const advanced = advancePregnancies([p], 30 + GESTATION_DAYS);
  assert.equal(advanced[0].state, MARE_STATE.FOALED);
});

test('pregnancyCost: 0 for no pregnancies', () => {
  assert.equal(pregnancyCost([]), 0);
});

test('pregnancyCost: 200 per active pregnancy', () => {
  const ps = [
    { state: MARE_STATE.PREGNANT },
    { state: MARE_STATE.NURSING },
    { state: MARE_STATE.BRED },  // not yet active
  ];
  assert.equal(pregnancyCost(ps), 400);
});

test('isMareUnavailable: pregnant mare cannot ride', () => {
  const ps = [{ damId: 'd1', state: MARE_STATE.PREGNANT }];
  assert.equal(isMareUnavailable(ps, 'd1'), true);
});

test('isMareUnavailable: open mare can ride', () => {
  const ps = [{ damId: 'd1', state: MARE_STATE.BRED }];
  assert.equal(isMareUnavailable(ps, 'd1'), false);
});

test('canStallionBreed: gelded cannot breed', () => {
  const stallion = { id: 's1', stallionState: STALLION_STATE.GELDED };
  assert.equal(canStallionBreed(stallion, [], 1), false);
});

test('canStallionBreed: active stallion can breed', () => {
  const stallion = { id: 's1', stallionState: STALLION_STATE.ACTIVE };
  assert.equal(canStallionBreed(stallion, [], 1), true);
});

test('canStallionBreed: max 12 breedings per year', () => {
  const stallion = { id: 's1', stallionState: STALLION_STATE.ACTIVE };
  const pregnancies = Array.from({ length: 12 }, () => ({ sireId: 's1' }));
  assert.equal(canStallionBreed(stallion, pregnancies, 1), false);
});

test('geldColt: marks colt as gelded', () => {
  const horse = { id: 'c1', name: 'Test', age: 2, bond: 30, training: 20, quirks: ['herd_bound'] };
  const gelded = geldColt(horse);
  assert.equal(gelded.stallionState, STALLION_STATE.GELDED);
  assert.equal(gelded.role, 'ranch gelding');
  assert.equal(gelded.bond, 38);
});

test('geldColt: removes herd_bound quirk', () => {
  const horse = { id: 'c1', age: 2, quirks: ['herd_bound', 'tarp_shy'] };
  const gelded = geldColt(horse);
  assert.ok(!gelded.quirks.includes('herd_bound'));
  assert.ok(gelded.quirks.includes('tarp_shy'));
});

test('oldHorseDecision: returns null for young horse', () => {
  const horse = { id: 'h1', age: 10 };
  assert.equal(oldHorseDecision(horse), null);
});

test('oldHorseDecision: returns 3 options for old horse', () => {
  const horse = { id: 'h1', age: 17, name: 'Old' };
  const decision = oldHorseDecision(horse);
  assert.ok(decision.retire);
  assert.ok(decision.putDown);
  assert.ok(decision.keepGoing);
});

test('generateFoal returns a new horse', () => {
  const sire = { id: 's1', breed: 'quarter_horse', temperament: 'steady' };
  const dam = { id: 'd1', breed: 'quarter_horse', temperament: 'calm' };
  const foal = generateFoal({ sireId: 's1', damId: 'd1' }, [sire, dam], 350);
  assert.equal(foal.age, 0);
  assert.ok(foal.parents);
  assert.equal(foal.parents.sire, 's1');
  assert.equal(foal.parents.dam, 'd1');
  assert.ok(foal.name);
  assert.ok(foal.quirks);
});

test('broodmareSeasonCost: only in spring/summer', () => {
  const ps = [{ state: MARE_STATE.PREGNANT }];
  assert.equal(broodmareSeasonCost(ps, 'Spring'), 200);
  assert.equal(broodmareSeasonCost(ps, 'Summer'), 200);
  assert.equal(broodmareSeasonCost(ps, 'Fall'), 0);
  assert.equal(broodmareSeasonCost(ps, 'Winter'), 0);
});