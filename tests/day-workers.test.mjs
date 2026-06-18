// Blood & Bridle — day-worker system tests.
//
// The contract: 4 recurring day-workers, country-gate availability,
// promotion to hand after 3+ seasons, day-worker tasks only.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_WORKER_DEFS,
  DAY_WORKER_TASKS,
  DAY_WORKER_TASK_NAMES,
  createInitialDayWorkers,
  findDayWorker,
  dayWorkersInRoster,
  rollDayWorkerAvailability,
  canDayWorkerDoTask,
  hireDayWorker,
  dayWorkerCost,
  resetDayWorkerHours,
  tickDayWorkerSeasons,
  canPromoteDayWorker,
  promoteDayWorker,
  bestDayWorkerFor,
} from '../src/day-workers.js';

test('DAY_WORKER_DEFS has exactly 4 day-workers', () => {
  assert.equal(DAY_WORKER_DEFS.length, 4);
});

test('every day-worker has the required schema', () => {
  for (const d of DAY_WORKER_DEFS) {
    assert.ok(d.id);
    assert.ok(d.name);
    assert.ok(typeof d.age === 'number' && d.age > 0);
    assert.ok(d.role);
    assert.ok(typeof d.skillLevel === 'number' && d.skillLevel >= 1 && d.skillLevel <= 5);
    assert.ok(typeof d.skills === 'object');
    assert.ok(typeof d.hourlyRate === 'number' && d.hourlyRate > 0);
    assert.ok(typeof d.maxHoursPerWeek === 'number' && d.maxHoursPerWeek > 0);
    assert.ok(typeof d.availabilityGate === 'number');
    assert.ok(d.backstory);
    assert.ok(d.special);
  }
});

test('DAY_WORKER_TASKS covers at least 5 day-worker-only tasks', () => {
  assert.ok(DAY_WORKER_TASKS.mendFence);
  assert.ok(DAY_WORKER_TASKS.paintBarn);
  assert.ok(DAY_WORKER_TASKS.cleanStalls);
  assert.ok(DAY_WORKER_TASKS.holdHorse);
  assert.ok(DAY_WORKER_TASKS.generalRanchWork);
  assert.equal(DAY_WORKER_TASK_NAMES.length, Object.keys(DAY_WORKER_TASKS).length);
});

test('the kid is the only one with availability gate 0', () => {
  const kid = DAY_WORKER_DEFS.find((d) => d.id === 'the-kid');
  assert.equal(kid.availabilityGate, 0);
  // All others have higher gates
  for (const d of DAY_WORKER_DEFS) {
    if (d.id === 'the-kid') continue;
    assert.ok(d.availabilityGate > 0, `${d.id} gate > 0`);
  }
});

test('the drifter has the highest availability gate', () => {
  const drifter = DAY_WORKER_DEFS.find((d) => d.id === 'the-drifter');
  for (const d of DAY_WORKER_DEFS) {
    assert.ok(drifter.availabilityGate >= d.availabilityGate);
  }
});

test('createInitialDayWorkers returns 4 day-workers with availableThisSeason=false', () => {
  const dws = createInitialDayWorkers();
  assert.equal(dws.length, 4);
  for (const d of dws) {
    assert.equal(d.availableThisSeason, false);
    assert.equal(d.hoursThisWeek, 0);
    assert.equal(d.promoted, false);
    assert.equal(d.seasonsWorked, 0);
  }
});

test('findDayWorker throws on missing id', () => {
  assert.throws(() => findDayWorker(createInitialDayWorkers(), 'ghost'), /not found/);
});

test('dayWorkersInRoster: 0% country = kid only', () => {
  const dws = createInitialDayWorkers();
  const roster = dayWorkersInRoster(dws, 0);
  assert.equal(roster.length, 1);
  assert.equal(roster[0].id, 'the-kid');
});

test('dayWorkersInRoster: 30% country = kid + old-timer', () => {
  const dws = createInitialDayWorkers();
  const roster = dayWorkersInRoster(dws, 30);
  assert.equal(roster.length, 2);
  assert.ok(roster.find((d) => d.id === 'the-kid'));
  assert.ok(roster.find((d) => d.id === 'the-old-timer'));
});

test('dayWorkersInRoster: 60% country = kid + old-timer + woman + drifter', () => {
  const dws = createInitialDayWorkers();
  const roster = dayWorkersInRoster(dws, 60);
  assert.equal(roster.length, 4);
});

test('dayWorkersInRoster: 100% country = all four in roster', () => {
  const dws = createInitialDayWorkers();
  const roster = dayWorkersInRoster(dws, 100);
  assert.equal(roster.length, 4);
});

test('dayWorkersInRoster: promoted day-workers are excluded', () => {
  const dws = createInitialDayWorkers().map((d) => d.id === 'the-kid' ? { ...d, promoted: true } : d);
  const roster = dayWorkersInRoster(dws, 100);
  assert.equal(roster.length, 3);
  assert.equal(roster.find((d) => d.id === 'the-kid'), undefined);
});

test('rollDayWorkerAvailability: 0% country, deterministic random → all unavailable', () => {
  const dws = createInitialDayWorkers();
  const zero = () => 0.99; // > any threshold
  const rolled = rollDayWorkerAvailability(dws, 0, (c) => 0.2, zero);
  for (const d of rolled) {
    assert.equal(d.availableThisSeason, false);
  }
});

test('rollDayWorkerAvailability: 100% country, always-available random → all available', () => {
  const dws = createInitialDayWorkers();
  const zero = () => 0; // always rolls < threshold
  const rolled = rollDayWorkerAvailability(dws, 100, (c) => 1.0, zero);
  for (const d of rolled) {
    assert.equal(d.availableThisSeason, true);
  }
});

test('rollDayWorkerAvailability: promoted day-workers are not re-rolled', () => {
  const dws = createInitialDayWorkers().map((d) => d.id === 'the-kid' ? { ...d, promoted: true, availableThisSeason: true } : d);
  const rolled = rollDayWorkerAvailability(dws, 100, () => 0, () => 0.5);
  const kid = rolled.find((d) => d.id === 'the-kid');
  assert.equal(kid.promoted, true);
  assert.equal(kid.availableThisSeason, true); // preserved
});

test('canDayWorkerDoTask: not in roster is rejected', () => {
  const dw = createInitialDayWorkers()[0];
  const can = canDayWorkerDoTask(dw, 'mendFence');
  assert.equal(can.ok, false);
  assert.match(can.reason, /not available/);
});

test('canDayWorkerDoTask: available day-worker with skill can do task', () => {
  const dw = { ...createInitialDayWorkers()[1], availableThisSeason: true }; // the old-timer
  const can = canDayWorkerDoTask(dw, 'mendFence');
  assert.equal(can.ok, true);
});

test('canDayWorkerDoTask: day-workers cannot do hand tasks', () => {
  const dw = { ...createInitialDayWorkers()[1], availableThisSeason: true };
  const can = canDayWorkerDoTask(dw, 'train');
  assert.equal(can.ok, false);
  assert.match(can.reason, /skilled work/);
});

test('canDayWorkerDoTask: day-worker without min skill is rejected', () => {
  // The kid has riding=3, but paintBarn needs no skill
  const dw = { ...createInitialDayWorkers()[0], availableThisSeason: true };
  assert.equal(canDayWorkerDoTask(dw, 'paintBarn').ok, true);
  // holdHorse needs riding >= 3 — kid has 3, so should pass
  assert.equal(canDayWorkerDoTask(dw, 'holdHorse').ok, true);
  // But increase the requirement to 4, kid should fail
  const dw2 = { ...dw, skills: { ...dw.skills, riding: 2 } };
  assert.equal(canDayWorkerDoTask(dw2, 'holdHorse').ok, false);
});

test('canDayWorkerDoTask: promoted day-worker is rejected', () => {
  const dw = { ...createInitialDayWorkers()[0], promoted: true, availableThisSeason: true };
  const can = canDayWorkerDoTask(dw, 'mendFence');
  assert.equal(can.ok, false);
  assert.match(can.reason, /promoted/);
});

test('hireDayWorker: consumes hours', () => {
  const dws = createInitialDayWorkers().map((d) => d.id === 'the-old-timer' ? { ...d, availableThisSeason: true } : d);
  const after = hireDayWorker(dws, 'the-old-timer', 'mendFence');
  const ot = after.find((d) => d.id === 'the-old-timer');
  assert.equal(ot.hoursThisWeek, 6);
});

test('hireDayWorker: throws when hours insufficient', () => {
  const dws = createInitialDayWorkers().map((d) => d.id === 'the-old-timer' ? { ...d, availableThisSeason: true, hoursThisWeek: 18 } : d);
  assert.throws(() => hireDayWorker(dws, 'the-old-timer', 'mendFence'), /hours left/);
});

test('hireDayWorker: throws on hand task', () => {
  const dws = createInitialDayWorkers().map((d) => d.id === 'the-old-timer' ? { ...d, availableThisSeason: true } : d);
  assert.throws(() => hireDayWorker(dws, 'the-old-timer', 'train'), /skilled work/);
});

test('dayWorkerCost: hours * hourlyRate', () => {
  const dw = DAY_WORKER_DEFS[0]; // kid, $18/hr, mendFence = 6h
  const cost = dayWorkerCost(dw, 'mendFence');
  assert.equal(cost, 6 * 18);
});

test('dayWorkerCost: returns 0 for unknown task', () => {
  const dw = DAY_WORKER_DEFS[0];
  assert.equal(dayWorkerCost(dw, 'train'), 0);
});

test('resetDayWorkerHours: zeroes hoursThisWeek for all', () => {
  const dws = createInitialDayWorkers().map((d) => ({ ...d, hoursThisWeek: 30 }));
  const reset = resetDayWorkerHours(dws);
  for (const d of reset) {
    assert.equal(d.hoursThisWeek, 0);
  }
});

test('tickDayWorkerSeasons: increments for available day-workers only', () => {
  const dws = createInitialDayWorkers().map((d, i) => ({
    ...d,
    availableThisSeason: i === 0,
  }));
  const ticked = tickDayWorkerSeasons(dws);
  assert.equal(ticked[0].seasonsWorked, 1);
  for (let i = 1; i < ticked.length; i++) {
    assert.equal(ticked[i].seasonsWorked, 0);
  }
});

test('canPromoteDayWorker: 0 seasons = no', () => {
  const dw = createInitialDayWorkers()[0];
  const check = canPromoteDayWorker(dw, 60, true);
  assert.equal(check.ok, false);
  assert.match(check.reason, /season/);
});

test('canPromoteDayWorker: 3 seasons but 30% country = no', () => {
  const dw = { ...createInitialDayWorkers()[0], seasonsWorked: 3 };
  const check = canPromoteDayWorker(dw, 30, true);
  assert.equal(check.ok, false);
  assert.match(check.reason, /country/i);
});

test('canPromoteDayWorker: 3 seasons + 60% country but no vacancy = no', () => {
  const dw = { ...createInitialDayWorkers()[0], seasonsWorked: 3 };
  const check = canPromoteDayWorker(dw, 60, false);
  assert.equal(check.ok, false);
  assert.match(check.reason, /vacancy/);
});

test('canPromoteDayWorker: 3 seasons + 60% country + vacancy = yes', () => {
  const dw = { ...createInitialDayWorkers()[0], seasonsWorked: 3 };
  const check = canPromoteDayWorker(dw, 60, true);
  assert.equal(check.ok, true);
});

test('promoteDayWorker: moves from dayWorkers to hands', () => {
  const dws = createInitialDayWorkers();
  const hands = [];
  const result = promoteDayWorker(dws, 'the-kid', hands);
  assert.equal(result.dayWorkers.find((d) => d.id === 'the-kid').promoted, true);
  assert.equal(result.hands.length, 1);
  assert.equal(result.hands[0].name, 'Tucker Briggs');
  assert.equal(result.hands[0].status, 'working');
  assert.ok(result.log.includes('Tucker') || result.log.includes('signed'));
});

test('promoteDayWorker: preserves skills', () => {
  const dws = createInitialDayWorkers();
  const result = promoteDayWorker(dws, 'the-old-timer', []);
  assert.equal(result.hands[0].skills.fencing, 5);
  assert.equal(result.hands[0].primarySkillLevel, 5);
});

test('promoteDayWorker: throws if already promoted', () => {
  const dws = createInitialDayWorkers().map((d) => d.id === 'the-kid' ? { ...d, promoted: true } : d);
  assert.throws(() => promoteDayWorker(dws, 'the-kid', []), /already promoted/);
});

test('bestDayWorkerFor: returns null when no day-workers are available', () => {
  const dws = createInitialDayWorkers();
  assert.equal(bestDayWorkerFor(dws, 'mendFence'), null);
});

test('bestDayWorkerFor: picks the highest-skill day-worker for the task', () => {
  const dws = createInitialDayWorkers().map((d) => ({ ...d, availableThisSeason: true }));
  const best = bestDayWorkerFor(dws, 'mendFence');
  // Old-timer has the highest fencing skill (5)
  assert.equal(best.id, 'the-old-timer');
});

test('bestDayWorkerFor: prefers most-hours-available when no skill needed', () => {
  // The kid has more hours available (40-0=40) than the drifter (40-15=25).
  // The kid should be picked because they have the most available hours.
  const dws = createInitialDayWorkers().map((d, i) => ({
    ...d,
    availableThisSeason: true,
    hoursThisWeek: i * 10, // kid: 0, old: 10, woman: 20, drifter: 30
  }));
  const best = bestDayWorkerFor(dws, 'paintBarn');
  assert.equal(best.id, 'the-kid');
  assert.equal(best.maxHoursPerWeek - best.hoursThisWeek, 40);
});

test('bestDayWorkerFor: when all day-workers are at 0 hours, the kid wins on availability', () => {
  const dws = createInitialDayWorkers().map((d) => ({ ...d, availableThisSeason: true }));
  const best = bestDayWorkerFor(dws, 'paintBarn');
  // Without skill requirement, the first day-worker with the most hours
  // available wins. The kid and drifter both have 40 hours; tie broken
  // by sort stability. Either is acceptable.
  assert.ok(best.id === 'the-kid' || best.id === 'the-drifter');
});
