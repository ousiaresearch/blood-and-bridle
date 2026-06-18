// Blood & Bridle — labor system tests.
//
// The contract: 5 hands with skills, hours, morale, status. Tasks
// consume hours and require minimum skill levels. Hands can be
// injured, sick, grieving, or gone. Departure rolls factor in the
// crew corner and individual morale.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HAND_STATUS,
  HANDS,
  TASK_HOURS,
  TASK_SKILL,
  MIN_SKILL,
  createInitialHands,
  findHand,
  canDoTask,
  consumeHandHours,
  taskHours,
  resetWeeklyHours,
  injureHand,
  tickHandInjuries,
  adjustHandMorale,
  adjustHandsMorale,
  totalMonthlyWages,
  totalAvailableHours,
  rollHandDepartures,
  workingHandCount,
  effectiveSkillLevel,
} from '../src/labor.js';

test('HANDS has exactly 5 hands', () => {
  assert.equal(HANDS.length, 5);
});

test('every hand has the required schema', () => {
  for (const h of HANDS) {
    assert.ok(h.id, 'id');
    assert.ok(h.name, 'name');
    assert.ok(h.role, 'role');
    assert.ok(typeof h.hoursPerWeek === 'number' && h.hoursPerWeek > 0, 'hoursPerWeek');
    assert.ok(typeof h.skills === 'object', 'skills');
    assert.ok(typeof h.primarySkill === 'string', 'primarySkill');
    assert.ok(typeof h.primarySkillLevel === 'number', 'primarySkillLevel');
    assert.ok(typeof h.wage === 'number', 'wage');
    assert.ok(typeof h.initialMorale === 'number', 'initialMorale');
  }
});

test('Mae is the head trainer with the highest riding skill', () => {
  const mae = HANDS.find((h) => h.id === 'mae');
  assert.equal(mae.primarySkill, 'riding');
  assert.ok(mae.skills.riding >= 8, 'Mae has high riding');
});

test('Eli is the ranch hand with the highest fencing skill', () => {
  const eli = HANDS.find((h) => h.id === 'eli');
  assert.equal(eli.primarySkill, 'fencing');
  assert.ok(eli.skills.fencing >= 7, 'Eli has high fencing');
});

test('Reyes is the stallion handler with the highest breeding skill', () => {
  const reyes = HANDS.find((h) => h.id === 'reyes');
  assert.equal(reyes.primarySkill, 'breeding');
  assert.ok(reyes.skills.breeding >= 8, 'Reyes has high breeding');
});

test('Elena is the bookkeeper with the highest bookkeeping skill', () => {
  const elena = HANDS.find((h) => h.id === 'elena');
  assert.equal(elena.primarySkill, 'bookkeeping');
  assert.ok(elena.skills.bookkeeping >= 8);
});

test('Voss is the vet with the highest medical skill and is on call', () => {
  const voss = HANDS.find((h) => h.id === 'cordell-voss');
  assert.equal(voss.primarySkill, 'medical');
  assert.ok(voss.skills.medical >= 8);
  assert.equal(voss.perCall, true, 'Voss is on retainer');
});

test('createInitialHands returns 5 hands with full schema and WORKING status', () => {
  const hands = createInitialHands();
  assert.equal(hands.length, 5);
  for (const h of hands) {
    assert.equal(h.status, HAND_STATUS.WORKING);
    assert.equal(h.hoursThisWeek, 0);
    assert.equal(h.injury, null);
    assert.ok(h.backstory, 'every hand has a backstory stub');
  }
});

test('findHand throws on missing id', () => {
  assert.throws(() => findHand(createInitialHands(), 'ghost'), /not found/);
});

test('canDoTask: working hand with required skill can do task', () => {
  const hands = createInitialHands();
  const mae = findHand(hands, 'mae');
  const can = canDoTask(mae, 'train');
  assert.equal(can.ok, true);
});

test('canDoTask: Voss cannot do non-vet tasks (per-call)', () => {
  const hands = createInitialHands();
  const voss = findHand(hands, 'cordell-voss');
  const can = canDoTask(voss, 'train');
  assert.equal(can.ok, false);
  assert.match(can.reason, /retainer|on call/i);
});

test('canDoTask: Voss can do vet tasks', () => {
  const hands = createInitialHands();
  const voss = findHand(hands, 'cordell-voss');
  assert.equal(canDoTask(voss, 'vetCare').ok, true);
  assert.equal(canDoTask(voss, 'vossPreventiveCare').ok, true);
});

test('canDoTask: gone hand cannot do any task', () => {
  const hands = createInitialHands().map((h) => h.id === 'mae' ? { ...h, status: HAND_STATUS.GONE } : h);
  const mae = findHand(hands, 'mae');
  const can = canDoTask(mae, 'train');
  assert.equal(can.ok, false);
  assert.match(can.reason, /gone/);
});

test('canDoTask: injured hand cannot do any task', () => {
  const hands = createInitialHands().map((h) => h.id === 'mae' ? { ...h, status: HAND_STATUS.INJURED, injury: { type: 'leg', daysLeft: 5 } } : h);
  const mae = findHand(hands, 'mae');
  const can = canDoTask(mae, 'train');
  assert.equal(can.ok, false);
  assert.match(can.reason, /injured/);
});

test('canDoTask: hand without required skill is rejected', () => {
  const hands = createInitialHands().map((h) => h.id === 'elena' ? { ...h, skills: { ...h.skills, riding: 1 } } : h);
  const elena = findHand(hands, 'elena');
  const can = canDoTask(elena, 'train');
  assert.equal(can.ok, false);
  assert.match(can.reason, /riding/);
});

test('TASK_HOURS: every action has a defined hours value (or null for parcel)', () => {
  assert.ok(typeof TASK_HOURS.train === 'number');
  assert.ok(typeof TASK_HOURS.maeAdvancedTraining === 'number');
  assert.ok(typeof TASK_HOURS.eliFindHayDeal === 'number');
  assert.ok(typeof TASK_HOURS.vossPreventiveCare === 'number');
  assert.ok(typeof TASK_HOURS.rotatePasture === 'number');
  assert.ok(typeof TASK_HOURS.enterShow === 'number');
  assert.ok(typeof TASK_HOURS.breed === 'number');
  assert.ok(typeof TASK_HOURS.vetCare === 'number');
  assert.equal(TASK_HOURS.improveParcel, null); // uses parcel laborHours
});

test('TASK_SKILL: every hand-requiring task maps to a skill', () => {
  assert.equal(TASK_SKILL.train, 'riding');
  assert.equal(TASK_SKILL.maeAdvancedTraining, 'coltStarting');
  assert.equal(TASK_SKILL.vetCare, 'medical');
  assert.equal(TASK_SKILL.rotatePasture, 'fencing');
});

test('consumeHandHours: working hand with hours can do task', () => {
  const hands = createInitialHands();
  const mae = findHand(hands, 'mae');
  const after = consumeHandHours(mae, 'train');
  assert.equal(after.hoursThisWeek, 4);
});

test('consumeHandHours: throws when hours insufficient', () => {
  const hands = createInitialHands().map((h) => h.id === 'mae' ? { ...h, hoursThisWeek: h.hoursPerWeek - 2 } : h);
  const mae = findHand(hands, 'mae');
  assert.throws(() => consumeHandHours(mae, 'train'), /hours left/);
});

test('consumeHandHours: throws when hand cannot do task', () => {
  const hands = createInitialHands().map((h) => h.id === 'mae' ? { ...h, status: HAND_STATUS.INJURED } : h);
  const mae = findHand(hands, 'mae');
  assert.throws(() => consumeHandHours(mae, 'train'), /injured/);
});

test('consumeHandHours: improveParcel uses parcel laborHours', () => {
  const hands = createInitialHands();
  const eli = findHand(hands, 'eli');
  // Improvements span multiple weeks; test with a single-week chunk
  const after = consumeHandHours(eli, 'improveParcel', 30);
  assert.equal(after.hoursThisWeek, 30);
});

test('taskHours: returns 0 for unknown task', () => {
  assert.equal(taskHours('nope'), 0);
});

test('resetWeeklyHours: zeroes hoursThisWeek for all hands', () => {
  const hands = createInitialHands().map((h) => ({ ...h, hoursThisWeek: 30 }));
  const reset = resetWeeklyHours(hands);
  for (const h of reset) {
    assert.equal(h.hoursThisWeek, 0);
  }
});

test('injureHand: marks hand as injured with details', () => {
  const hands = createInitialHands();
  const eli = findHand(hands, 'eli');
  const injured = injureHand(eli, 'broken rib', 14, 'moderate');
  assert.equal(injured.status, HAND_STATUS.INJURED);
  assert.equal(injured.injury.type, 'broken rib');
  assert.equal(injured.injury.daysLeft, 14);
  assert.equal(injured.injury.severity, 'moderate');
  assert.equal(injured.hoursThisWeek, 0);
});

test('tickHandInjuries: counts down injury days and returns to work', () => {
  const hands = createInitialHands().map((h) => h.id === 'eli' ? injureHand(h, 'cut', 2) : h);
  const day1 = tickHandInjuries(hands);
  const eli1 = findHand(day1, 'eli');
  assert.equal(eli1.status, HAND_STATUS.INJURED);
  assert.equal(eli1.injury.daysLeft, 1);
  const day2 = tickHandInjuries(day1);
  const eli2 = findHand(day2, 'eli');
  assert.equal(eli2.status, HAND_STATUS.WORKING);
  assert.equal(eli2.injury, null);
});

test('adjustHandMorale: clamps between 0 and 100', () => {
  const hands = createInitialHands();
  const mae = findHand(hands, 'mae');
  assert.equal(adjustHandMorale(mae, 50).morale, 100);
  assert.equal(adjustHandMorale(mae, -200).morale, 0);
});

test('adjustHandsMorale: applies delta to all hands', () => {
  const hands = createInitialHands();
  const after = adjustHandsMorale(hands, -10);
  for (let i = 0; i < hands.length; i++) {
    assert.equal(after[i].morale, hands[i].morale - 10);
  }
});

test('totalMonthlyWages: excludes per-call hands', () => {
  const hands = createInitialHands();
  const total = totalMonthlyWages(hands);
  // Mae (2400) + Eli (1600) + Reyes (2000) + Elena (1800) = 7800
  assert.equal(total, 7800);
});

test('totalMonthlyWages: excludes gone hands', () => {
  const hands = createInitialHands().map((h) => h.id === 'mae' ? { ...h, status: HAND_STATUS.GONE } : h);
  const total = totalMonthlyWages(hands);
  assert.equal(total, 5400); // 7800 - 2400
});

test('totalAvailableHours: sums remaining hours across working hands', () => {
  const hands = createInitialHands();
  const total = totalAvailableHours(hands);
  // 5 working hands, all at 0 hours this week: 40+40+40+40+30 = 190
  assert.equal(total, 190);
});

test('rollHandDepartures: high crew risk = guaranteed departure', () => {
  const hands = createInitialHands();
  // Force a guaranteed departure: 0% crew = 1.0 risk, low morale = high personal risk
  const lowMorale = hands.map((h) => ({ ...h, morale: 5 }));
  const after = rollHandDepartures(lowMorale, 1.0);
  const stillWorking = after.filter((h) => h.status === HAND_STATUS.WORKING);
  assert.ok(stillWorking.length < 5, 'at least one hand left');
});

test('rollHandDepartures: per-call hands never leave (Voss)', () => {
  const hands = createInitialHands();
  const after = rollHandDepartures(hands, 1.0);
  const voss = after.find((h) => h.id === 'cordell-voss');
  assert.notEqual(voss.status, HAND_STATUS.GONE);
});

test('rollHandDepartures: high morale + low crew risk = no departure', () => {
  const hands = createInitialHands();
  // Per-call hands don't leave; non-per-call hands have morale 58-77.
  // With crew risk 0 and good morale, very few (if any) should leave.
  let departures = 0;
  for (let i = 0; i < 20; i++) {
    const r = rollHandDepartures(hands, 0);
    departures += r.filter((h) => h.status === HAND_STATUS.GONE).length;
  }
  assert.ok(departures < 5, `low crew risk yields few departures (got ${departures} in 20 rolls)`);
});

test('workingHandCount: counts hands with WORKING status', () => {
  const hands = createInitialHands();
  assert.equal(workingHandCount(hands), 5);
  const after = hands.map((h) => h.id === 'mae' ? { ...h, status: HAND_STATUS.GONE } : h);
  assert.equal(workingHandCount(after), 4);
});

test('effectiveSkillLevel: high morale preserves skill', () => {
  const hands = createInitialHands();
  const mae = findHand(hands, 'mae');
  const after = { ...mae, morale: 80 };
  assert.equal(effectiveSkillLevel(after, 'riding'), 9);
});

test('effectiveSkillLevel: low morale reduces effective skill', () => {
  const hands = createInitialHands();
  const mae = findHand(hands, 'mae');
  const after = { ...mae, morale: 30 };
  const level = effectiveSkillLevel(after, 'riding');
  assert.ok(level < 9, `low morale should reduce effective skill (got ${level})`);
});
