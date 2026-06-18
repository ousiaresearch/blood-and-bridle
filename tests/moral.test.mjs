// Blood & Bridle — moral economy + ledger book tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MORAL_CATEGORIES,
  MORAL_CONSEQUENCES,
  createMoralState,
  skipObligation,
  recordSkip,
  tickMoralConsequences,
  skippedSavings,
  skipWarning,
} from '../src/moral.js';
import {
  buildLedgerBookModel,
  buildLedgerPage,
} from '../src/ledger-book.js';

test('MORAL_CATEGORIES has the expected skip categories', () => {
  assert.ok(MORAL_CATEGORIES.FARRIER);
  assert.ok(MORAL_CATEGORIES.WAGES);
  assert.ok(MORAL_CATEGORIES.PROPERTY_TAX);
  assert.ok(MORAL_CATEGORIES.VETERINARY);
});

test('MORAL_CONSEQUENCES has a definition for every category', () => {
  for (const cat of Object.values(MORAL_CATEGORIES)) {
    assert.ok(MORAL_CONSEQUENCES[cat], `${cat} has consequences`);
  }
});

test('createMoralState returns empty state', () => {
  const ms = createMoralState();
  assert.deepEqual(ms.skips, []);
  assert.equal(ms.choices, 0);
});

test('skipObligation: computes savings based on horse count for farrier', () => {
  const game = { horses: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }] };
  const skip = skipObligation(game, 'farrier');
  assert.equal(skip.savings, 270);  // 3 × 90
  assert.equal(skip.skipped, true);
});

test('skipObligation: computes savings based on hand count for wages', () => {
  const game = { hands: [{ id: 'mae', perCall: false, status: 'working' }, { id: 'eli', perCall: false, status: 'working' }] };
  const skip = skipObligation(game, 'wages');
  assert.equal(skip.savings, 1000);  // 2 × 500
});

test('skipObligation: throws on unknown category', () => {
  assert.throws(() => skipObligation({}, 'unknown'), /Unknown moral category/);
});

test('recordSkip: adds to skips and increments choices', () => {
  const ms = createMoralState();
  const next = recordSkip(ms, { savings: 500, category: 'farrier', day: 1, season: 'Spring', consequence: { label: 'Skip the farrier' } });
  assert.equal(next.skips.length, 1);
  assert.equal(next.choices, 1);
});

test('tickMoralConsequences: fired skips do not re-fire', () => {
  const ms = {
    skips: [{ category: 'farrier', savings: 500, day: 1, season: 'Spring', fired: true }],
    choices: 1,
    consequencesFired: 1,
  };
  const result = tickMoralConsequences(ms, { horses: [], hands: [] });
  assert.equal(result.horseEffects.length, 0);
});

test('tickMoralConsequences: unfired farrier skip can injure a horse', () => {
  let ms = createMoralState();
  ms = recordSkip(ms, {
    category: 'farrier', savings: 90, day: 1, season: 'Spring',
    consequence: MORAL_CONSEQUENCES.farrier,
  });
  // Force horseInjuryChance to fire by using a deterministic random that returns 0
  const result = tickMoralConsequences(ms, { horses: [{ id: 'h1', name: 'Pinto', age: 3 }], hands: [] }, () => 0);
  assert.ok(result.horseEffects.length > 0, 'horse should be injured');
});

test('tickMoralConsequences: unfired wages skip can cause hand departure', () => {
  let ms = createMoralState();
  ms = recordSkip(ms, {
    category: 'wages', savings: 500, day: 1, season: 'Spring',
    consequence: MORAL_CONSEQUENCES.wages,
  });
  const result = tickMoralConsequences(ms, {
    horses: [],
    hands: [{ id: 'mae', status: 'working', perCall: false }],
  }, () => 0);
  assert.ok(result.handEffects.length > 0, 'hand should depart');
});

test('tickMoralConsequences: tax skip damages bank corner', () => {
  let ms = createMoralState();
  ms = recordSkip(ms, {
    category: 'property_tax', savings: 1200, day: 1, season: 'Spring',
    consequence: MORAL_CONSEQUENCES.property_tax,
  });
  const result = tickMoralConsequences(ms, { horses: [], hands: [] }, () => 0);
  assert.ok(result.cornerAdjustments.bank < 0, 'bank corner damaged');
});

test('skippedSavings returns the same value as skipObligation', () => {
  const game = { horses: [{ id: 'h1' }, { id: 'h2' }] };
  assert.equal(skippedSavings('farrier', game), skipObligation(game, 'farrier').savings);
});

test('skipWarning returns a line for every category', () => {
  for (const cat of Object.values(MORAL_CATEGORIES)) {
    const w = skipWarning(cat);
    assert.ok(typeof w === 'string' && w.length > 0, `${cat} has a warning`);
  }
});

test('buildLedgerBookModel: returns the structured book', () => {
  const game = {
    ranchName: 'Double Down',
    ranchBrand: 'bar-d',
    day: 90,
    season: 'Summer',
    ledger: [
      { type: 'income', category: 'horse_sale', amount: 5000, day: 60, season: 'Spring', note: 'Sold horse' },
      { type: 'expense', category: 'feed', amount: -1800, day: 30, season: 'Spring', note: 'Feed' },
    ],
    staff: [{ id: 'mae', name: 'Mae Calder', role: 'Head trainer' }],
    reputationCorners: { horsemen: 60, country: 50, bank: 70, crew: 65 },
    cash: 20000,
    legacy: 70,
  };
  const model = buildLedgerBookModel(game);
  assert.equal(model.title, 'Double Down');
  assert.equal(model.brand, 'bar-d');
  assert.ok(model.parchmentNote.length > 0);
  assert.ok(model.recentEntries.length === 2);
  assert.ok(model.foreman.name === 'Mae Calder');
});

test('buildLedgerBookModel: picks bank corner for parchment when bank is highest', () => {
  const game = {
    ranchName: 'Test', day: 1, season: 'Spring', ledger: [],
    staff: [{ id: 'mae', name: 'Mae', role: 'Foreman' }],
    reputationCorners: { horsemen: 30, country: 30, bank: 90, crew: 30 },
    cash: 10000, legacy: 70,
  };
  const model = buildLedgerBookModel(game);
  assert.ok(model.parchmentNote.includes('bank') || model.parchmentNote.includes('call'));
});

test('buildLedgerBookModel: warns when cash is negative', () => {
  const game = {
    ranchName: 'Test', day: 1, season: 'Spring', ledger: [],
    staff: [{ id: 'mae', name: 'Mae', role: 'Foreman' }],
    reputationCorners: { horsemen: 50, country: 50, bank: 50, crew: 50 },
    cash: -5000, legacy: 70,
  };
  const model = buildLedgerBookModel(game);
  assert.ok(model.parchmentNote.includes('red') || model.parchmentNote.includes('foreman'));
});

test('buildLedgerPage: returns page entries', () => {
  const game = {
    ranchName: 'Test', day: 30, season: 'Spring', ledger: [],
    staff: [{ id: 'mae', name: 'Mae', role: 'Foreman' }],
    reputationCorners: { horsemen: 50, country: 50, bank: 50, crew: 50 },
    cash: 5000, legacy: 70,
  };
  const page = buildLedgerPage(game, 0);
  assert.ok(Array.isArray(page.pageEntries));
  assert.equal(typeof page.totalPages, 'number');
  assert.equal(page.currentPage, 1);
});

test('buildLedgerBookModel: seasonTallies break down by season', () => {
  const game = {
    ranchName: 'Test', day: 120, season: 'Summer', ledger: [
      { type: 'income', category: 'sale', amount: 5000, day: 30, season: 'Spring' },
      { type: 'expense', category: 'feed', amount: -2000, day: 60, season: 'Spring' },
      { type: 'income', category: 'sale', amount: 3000, day: 90, season: 'Summer' },
    ],
    staff: [{ id: 'mae', name: 'Mae', role: 'Foreman' }],
    reputationCorners: { horsemen: 50, country: 50, bank: 50, crew: 50 },
    cash: 5000, legacy: 70,
  };
  const model = buildLedgerBookModel(game);
  assert.equal(model.seasonTallies.Spring.income, 5000);
  assert.equal(model.seasonTallies.Spring.expense, 2000);
  assert.equal(model.seasonTallies.Summer.income, 3000);
});