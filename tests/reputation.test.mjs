// Blood & Bridle — four-cornered reputation tests.
//
// The contract: 4 independent 0-100 corners. Each action that touches
// reputation goes through one or more corners, never the legacy single
// field directly. Overall reputation is the binding-constraint
// (minimum) reading.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REPUTATION_CORNERS,
  CORNER_LABELS,
  INITIAL_CORNER_VALUES,
  CORNER_THRESHOLDS,
  adjustCorner,
  adjustCorners,
  getOverallReputation,
  getCollapsedCorner,
  cornerThreshold,
  cornerStandingLine,
  createInitialReputation,
  dayWorkerAvailability,
  loanTerms,
  showInvitationLevel,
  crewDepartureRisk,
  recomputeOverallReputation,
} from '../src/reputation.js';

test('REPUTATION_CORNERS has exactly four corners', () => {
  const keys = Object.keys(REPUTATION_CORNERS);
  assert.equal(keys.length, 4);
  assert.ok(REPUTATION_CORNERS.horsemen);
  assert.ok(REPUTATION_CORNERS.country);
  assert.ok(REPUTATION_CORNERS.bank);
  assert.ok(REPUTATION_CORNERS.crew);
});

test('CORNER_LABELS has a human label for every corner', () => {
  for (const c of Object.values(REPUTATION_CORNERS)) {
    assert.ok(typeof CORNER_LABELS[c] === 'string');
    assert.ok(CORNER_LABELS[c].length > 0);
  }
});

test('INITIAL_CORNER_VALUES has a starting value for every corner', () => {
  for (const c of Object.values(REPUTATION_CORNERS)) {
    assert.ok(typeof INITIAL_CORNER_VALUES[c] === 'number');
    assert.ok(INITIAL_CORNER_VALUES[c] >= 0 && INITIAL_CORNER_VALUES[c] <= 100);
  }
});

test('createInitialReputation returns a copy of INITIAL_CORNER_VALUES', () => {
  const r = createInitialReputation();
  assert.deepEqual(r, INITIAL_CORNER_VALUES);
  // Mutating the copy should not affect the source
  r.horsemen = 99;
  assert.equal(INITIAL_CORNER_VALUES.horsemen, 38);
});

test('adjustCorner: positive delta increases the corner', () => {
  const r = createInitialReputation();
  const next = adjustCorner(r, 'horsemen', 10);
  assert.equal(next.horsemen, r.horsemen + 10);
});

test('adjustCorner: clamps at 0 and 100', () => {
  const r = createInitialReputation();
  const up = adjustCorner(r, 'horsemen', 200);
  assert.equal(up.horsemen, 100);
  const down = adjustCorner(r, 'horsemen', -200);
  assert.equal(down.horsemen, 0);
});

test('adjustCorner: returns new object, does not mutate', () => {
  const r = createInitialReputation();
  const before = r.horsemen;
  adjustCorner(r, 'horsemen', 50);
  assert.equal(r.horsemen, before, 'original reputation is unchanged');
});

test('adjustCorner: throws on unknown corner', () => {
  const r = createInitialReputation();
  assert.throws(() => adjustCorner(r, 'unknown', 5), /Unknown reputation corner/);
});

test('adjustCorners: applies multiple deltas at once', () => {
  const r = createInitialReputation();
  const next = adjustCorners(r, { horsemen: 10, bank: -5, crew: 3 });
  assert.equal(next.horsemen, r.horsemen + 10);
  assert.equal(next.bank, r.bank - 5);
  assert.equal(next.crew, r.crew + 3);
  assert.equal(next.country, r.country, 'untouched corner is unchanged');
});

test('adjustCorners: ignores unknown corners', () => {
  const r = createInitialReputation();
  const next = adjustCorners(r, { horsemen: 5, bogus: 100 });
  assert.equal(next.horsemen, r.horsemen + 5);
  assert.equal(next.bogus, undefined);
});

test('getOverallReputation: returns the minimum corner', () => {
  const r = { horsemen: 80, country: 60, bank: 90, crew: 70 };
  assert.equal(getOverallReputation(r), 60);
});

test('getOverallReputation: handles null/undefined', () => {
  assert.equal(getOverallReputation(null), 0);
  assert.equal(getOverallReputation(undefined), 0);
});

test('getOverallReputation: when one corner is 0, the overall is 0', () => {
  const r = { horsemen: 80, country: 0, bank: 90, crew: 70 };
  assert.equal(getOverallReputation(r), 0);
});

test('getCollapsedCorner: returns the corner at 0', () => {
  const r = { horsemen: 0, country: 50, bank: 50, crew: 50 };
  assert.equal(getCollapsedCorner(r), 'horsemen');
});

test('getCollapsedCorner: returns null when no corner is 0', () => {
  const r = { horsemen: 50, country: 1, bank: 50, crew: 50 };
  assert.equal(getCollapsedCorner(r), null);
});

test('getCollapsedCorner: handles null/undefined', () => {
  assert.equal(getCollapsedCorner(null), null);
  assert.equal(getCollapsedCorner(undefined), null);
});

test('cornerThreshold: returns the right tier for each value', () => {
  assert.equal(cornerThreshold('horsemen', 0), 'collapsed');
  assert.equal(cornerThreshold('horsemen', 10), 'critical');
  assert.equal(cornerThreshold('horsemen', 20), 'low');
  assert.equal(cornerThreshold('horsemen', 40), 'mid');
  assert.equal(cornerThreshold('horsemen', 60), 'high');
  assert.equal(cornerThreshold('horsemen', 80), 'excellent');
  assert.equal(cornerThreshold('horsemen', 95), 'renowned');
});

test('cornerStandingLine: returns a non-empty line for every tier of every corner', () => {
  for (const corner of Object.values(REPUTATION_CORNERS)) {
    for (const v of [0, 10, 25, 40, 60, 80, 95]) {
      const line = cornerStandingLine(corner, v);
      assert.ok(typeof line === 'string' && line.length > 0, `${corner}@${v} has a line`);
    }
  }
});

test('cornerStandingLine: horsemen at 0 is the saddest line', () => {
  const line = cornerStandingLine('horsemen', 0);
  assert.ok(line.includes('forgotten') || line.includes('invited'));
});

test('cornerStandingLine: country at 95 says "the country is your country"', () => {
  const line = cornerStandingLine('country', 95);
  assert.ok(line.includes('country'));
});

test('cornerStandingLine: bank at 0 is "the bank has called the note"', () => {
  const line = cornerStandingLine('bank', 0);
  assert.match(line, /bank.*called|note|line/i);
});

test('cornerStandingLine: crew at 0 is "the hands have walked off"', () => {
  const line = cornerStandingLine('crew', 0);
  assert.match(line, /hands|walked|bunkhouse/i);
});

test('dayWorkerAvailability: 0% country = 0.2 availability floor', () => {
  assert.equal(dayWorkerAvailability(0), 0.2);
});

test('dayWorkerAvailability: 100% country = 1.0 availability', () => {
  assert.equal(dayWorkerAvailability(100), 1.0);
});

test('dayWorkerAvailability: scales linearly between', () => {
  // Floating-point tolerant
  assert.ok(Math.abs(dayWorkerAvailability(50) - 0.6) < 1e-9);
  assert.ok(Math.abs(dayWorkerAvailability(25) - 0.4) < 1e-9);
});

test('loanTerms: collapsed bank = no loan', () => {
  const t = loanTerms(0);
  assert.equal(t.available, false);
  assert.equal(t.maxLoan, 0);
});

test('loanTerms: critical bank = small loan at high interest', () => {
  const t = loanTerms(10);
  assert.equal(t.available, true);
  assert.ok(t.maxLoan > 0);
  assert.ok(t.interestRate > 0.15, 'high interest at critical bank');
});

test('loanTerms: renowned bank = large loan at low interest', () => {
  const t = loanTerms(95);
  assert.equal(t.available, true);
  assert.ok(t.maxLoan >= 100000, 'large loan at renowned bank');
  assert.ok(t.interestRate < 0.10, 'low interest at renowned bank');
});

test('showInvitationLevel: 0 horsemen = no shows', () => {
  assert.equal(showInvitationLevel(0), 0);
});

test('showInvitationLevel: scales with horsemen corner', () => {
  assert.equal(showInvitationLevel(20), 1);
  assert.equal(showInvitationLevel(40), 2);
  assert.equal(showInvitationLevel(60), 3);
  assert.equal(showInvitationLevel(80), 4);
  assert.equal(showInvitationLevel(95), 5);
});

test('crewDepartureRisk: 0 crew = guaranteed departure', () => {
  assert.equal(crewDepartureRisk(0), 1.0);
});

test('crewDepartureRisk: 100 crew = no departure', () => {
  assert.equal(crewDepartureRisk(100), 0.0);
});

test('crewDepartureRisk: low crew = high risk', () => {
  assert.ok(crewDepartureRisk(20) > 0.1);
  assert.ok(crewDepartureRisk(40) < 0.1);
});

test('recomputeOverallReputation: returns the minimum', () => {
  const r = { horsemen: 80, country: 60, bank: 90, crew: 70 };
  assert.equal(recomputeOverallReputation(r), 60);
});

test('recomputeOverallReputation: handles missing corners', () => {
  assert.equal(recomputeOverallReputation({ horsemen: 50 }), 0);
});
