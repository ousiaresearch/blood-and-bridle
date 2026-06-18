// Blood & Bridle — economy tests.
//
// The contract: seasonal expenses/income fire on season boundaries,
// the ledger tracks every transaction, loans accrue interest and
// can be repaid, insolvency is detected after 3 negative seasons,
// hay prices spike in drought years, horse prices scale with the
// horsemen corner.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  BASE_MONTHLY,
  SEASONAL_EXPENSE_MULTIPLIER,
  HAY_BASE_PRICE,
  createInitialLedger,
  addExpense,
  addIncome,
  totalExpenses,
  totalIncome,
  netCashFlow,
  ledgerByCategory,
  computeSeasonalExpenses,
  computeSeasonalIncome,
  tickSeasonalEconomy,
  hayPriceMultiplier,
  horsePriceMultiplier,
  fuelPriceMultiplier,
  createLoan,
  maxLoanAvailable,
  interestRateFor,
  tickLoan,
  repayLoan,
  totalLoanDebt,
  isInsolvent,
  insolvencyWarning,
} from '../src/economy.js';

test('EXPENSE_CATEGORIES has the expected expense types', () => {
  assert.ok(EXPENSE_CATEGORIES.FEED);
  assert.ok(EXPENSE_CATEGORIES.VETERINARY);
  assert.ok(EXPENSE_CATEGORIES.FARRIER);
  assert.ok(EXPENSE_CATEGORIES.WAGES);
  assert.ok(EXPENSE_CATEGORIES.PROPERTY_TAX);
  assert.ok(EXPENSE_CATEGORIES.HAZARD);
  assert.ok(EXPENSE_CATEGORIES.INTEREST);
});

test('INCOME_CATEGORIES has the expected income types', () => {
  assert.ok(INCOME_CATEGORIES.HORSE_SALE);
  assert.ok(INCOME_CATEGORIES.STUD_FEE);
  assert.ok(INCOME_CATEGORIES.SHOW_WINNINGS);
  assert.ok(INCOME_CATEGORIES.BOARDING);
  assert.ok(INCOME_CATEGORIES.GRAZING_LEASE);
  assert.ok(INCOME_CATEGORIES.LOAN_DISBURSEMENT);
});

test('SEASONAL_EXPENSE_MULTIPLIER covers all four seasons', () => {
  assert.ok(SEASONAL_EXPENSE_MULTIPLIER.Spring);
  assert.ok(SEASONAL_EXPENSE_MULTIPLIER.Summer);
  assert.ok(SEASONAL_EXPENSE_MULTIPLIER.Fall);
  assert.ok(SEASONAL_EXPENSE_MULTIPLIER.Winter);
});

test('createInitialLedger returns empty array', () => {
  assert.deepEqual(createInitialLedger(), []);
});

test('addExpense: stores negative amount', () => {
  const ledger = addExpense(createInitialLedger(), {
    category: 'feed', amount: 500, day: 1, season: 'Spring',
  });
  assert.equal(ledger[0].amount, -500);
  assert.equal(ledger[0].type, 'expense');
});

test('addExpense: coerces positive amount to negative', () => {
  const ledger = addExpense(createInitialLedger(), {
    category: 'feed', amount: 1000, day: 1, season: 'Spring',
  });
  assert.equal(ledger[0].amount, -1000);
});

test('addIncome: stores positive amount', () => {
  const ledger = addIncome(createInitialLedger(), {
    category: 'horse_sale', amount: 5000, day: 1, season: 'Fall',
  });
  assert.equal(ledger[0].amount, 5000);
  assert.equal(ledger[0].type, 'income');
});

test('addIncome: coerces negative amount to positive', () => {
  const ledger = addIncome(createInitialLedger(), {
    category: 'horse_sale', amount: -100, day: 1, season: 'Fall',
  });
  assert.equal(ledger[0].amount, 100);
});

test('totalExpenses sums the absolute value of expense entries', () => {
  let ledger = createInitialLedger();
  ledger = addExpense(ledger, { category: 'feed', amount: 500, day: 1, season: 'Spring' });
  ledger = addExpense(ledger, { category: 'farrier', amount: 300, day: 2, season: 'Spring' });
  ledger = addIncome(ledger, { category: 'horse_sale', amount: 5000, day: 3, season: 'Fall' });
  assert.equal(totalExpenses(ledger), 800);
});

test('totalIncome sums income entries', () => {
  let ledger = createInitialLedger();
  ledger = addIncome(ledger, { category: 'horse_sale', amount: 5000, day: 1, season: 'Fall' });
  ledger = addExpense(ledger, { category: 'feed', amount: 500, day: 2, season: 'Spring' });
  assert.equal(totalIncome(ledger), 5000);
});

test('netCashFlow = income - expenses', () => {
  let ledger = createInitialLedger();
  ledger = addIncome(ledger, { category: 'horse_sale', amount: 5000, day: 1 });
  ledger = addExpense(ledger, { category: 'feed', amount: 500, day: 2 });
  ledger = addExpense(ledger, { category: 'farrier', amount: 300, day: 3 });
  assert.equal(netCashFlow(ledger), 4200);
});

test('ledgerByCategory groups by category with income/expense totals', () => {
  let ledger = createInitialLedger();
  ledger = addExpense(ledger, { category: 'feed', amount: 500, day: 1 });
  ledger = addExpense(ledger, { category: 'feed', amount: 300, day: 2 });
  ledger = addIncome(ledger, { category: 'horse_sale', amount: 5000, day: 3 });
  const groups = ledgerByCategory(ledger);
  assert.equal(groups.feed.expense, 800);
  assert.equal(groups.feed.income, 0);
  assert.equal(groups.horse_sale.income, 5000);
});

test('computeSeasonalExpenses: spring has farrier, no property tax', () => {
  const game = { day: 1, horses: [{ id: 'h1' }, { id: 'h2' }] };
  const expenses = computeSeasonalExpenses(game, 'Spring');
  const categories = expenses.map((e) => e.category);
  assert.ok(categories.includes('farrier'), 'spring has farrier');
  assert.ok(!categories.includes('property_tax'), 'spring has no property tax');
});

test('computeSeasonalExpenses: winter has property tax, no farrier', () => {
  const game = { day: 1, horses: [{ id: 'h1' }] };
  const expenses = computeSeasonalExpenses(game, 'Winter');
  const categories = expenses.map((e) => e.category);
  assert.ok(categories.includes('property_tax'), 'winter has property tax');
  assert.ok(!categories.includes('farrier'), 'winter has no farrier');
});

test('computeSeasonalExpenses: summer has equipment maintenance', () => {
  const game = { day: 1, horses: [{ id: 'h1' }] };
  const expenses = computeSeasonalExpenses(game, 'Summer');
  const categories = expenses.map((e) => e.category);
  assert.ok(categories.includes('equipment'));
});

test('computeSeasonalExpenses: feed scales with horse count', () => {
  const game1 = { day: 1, horses: [{ id: 'h1' }] };
  const game10 = { day: 1, horses: Array.from({ length: 10 }, (_, i) => ({ id: `h${i}` })) };
  const exp1 = computeSeasonalExpenses(game1, 'Spring');
  const exp10 = computeSeasonalExpenses(game10, 'Spring');
  const feed1 = exp1.find((e) => e.category === 'feed').amount;
  const feed10 = exp10.find((e) => e.category === 'feed').amount;
  assert.equal(feed10, feed1 * 10);
});

test('computeSeasonalExpenses: drought (weatherSeverity 1.6) raises feed cost', () => {
  const game = { day: 1, horses: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }] };
  const normal = computeSeasonalExpenses(game, 'Spring', 1.0);
  const drought = computeSeasonalExpenses(game, 'Spring', 1.6);
  const normalFeed = normal.find((e) => e.category === 'feed').amount;
  const droughtFeed = drought.find((e) => e.category === 'feed').amount;
  assert.ok(droughtFeed > normalFeed, `drought feed should be higher (normal=${normalFeed}, drought=${droughtFeed})`);
});

test('computeSeasonalExpenses: insurance only fires when enabled', () => {
  const game1 = { day: 1, horses: [{ id: 'h1' }] };
  const game2 = { day: 1, horses: [{ id: 'h1' }], insuranceEnabled: true };
  const exp1 = computeSeasonalExpenses(game1, 'Spring');
  const exp2 = computeSeasonalExpenses(game2, 'Spring');
  assert.ok(!exp1.some((e) => e.category === 'insurance'));
  assert.ok(exp2.some((e) => e.category === 'insurance'));
});

test('computeSeasonalIncome: grazing lease only at 50+ horsemen', () => {
  const game1 = { day: 1, reputationCorners: { horsemen: 30 } };
  const game2 = { day: 1, reputationCorners: { horsemen: 70 } };
  const inc1 = computeSeasonalIncome(game1, 'Spring');
  const inc2 = computeSeasonalIncome(game2, 'Spring');
  assert.ok(!inc1.some((i) => i.category === 'grazing_lease'));
  assert.ok(inc2.some((i) => i.category === 'grazing_lease'));
});

test('computeSeasonalIncome: hay harvest only with irrigated parcel', () => {
  const game1 = { day: 1, parcels: [] };
  const game2 = { day: 1, parcels: [{ improvement: 'irrigated' }] };
  const inc1 = computeSeasonalIncome(game1, 'Fall');
  const inc2 = computeSeasonalIncome(game2, 'Fall');
  assert.ok(!inc1.some((i) => i.category === 'hay_harvest'));
  assert.ok(inc2.some((i) => i.category === 'hay_harvest'));
});

test('computeSeasonalIncome: stud fee only with bonded stallion', () => {
  const game1 = { day: 1, stallionId: 'some-horse', stallionBonded: false };
  const game2 = { day: 1, stallionId: 'some-horse', stallionBonded: true };
  const inc1 = computeSeasonalIncome(game1, 'Fall');
  const inc2 = computeSeasonalIncome(game2, 'Fall');
  assert.ok(!inc1.some((i) => i.category === 'stud_fee'));
  assert.ok(inc2.some((i) => i.category === 'stud_fee'));
});

test('tickSeasonalEconomy: returns ledger, cashDelta, logLines', () => {
  const game = {
    day: 30,
    horses: [{ id: 'h1' }],
    hands: [{ id: 'mae', perCall: false, status: 'working' }],
    ledger: [],
  };
  const result = tickSeasonalEconomy(game);
  assert.ok(Array.isArray(result.ledger));
  assert.equal(typeof result.cashDelta, 'number');
  assert.ok(Array.isArray(result.logLines));
  assert.equal(typeof result.insolventSeasons, 'number');
});

test('tickSeasonalEconomy: spring season produces farrier entry', () => {
  const game = {
    day: 30,   // day 30 = end of spring
    horses: [{ id: 'h1' }, { id: 'h2' }],
    hands: [],
    ledger: [],
  };
  const result = tickSeasonalEconomy(game);
  assert.ok(result.ledger.some((e) => e.category === 'farrier'));
});

test('tickSeasonalEconomy: insolventSeasons increments when cash is below -1000', () => {
  const game = {
    day: 30,
    cash: -5000,
    horses: [],
    hands: [],
    ledger: [],
  };
  const result = tickSeasonalEconomy(game);
  assert.ok(result.insolventSeasons >= 1);
});

test('tickSeasonalEconomy: insolventSeasons resets when cash recovers', () => {
  const game = {
    day: 30,
    cash: 5000,
    horses: [],
    hands: [],
    ledger: [],
    insolventSeasons: 2,
  };
  const result = tickSeasonalEconomy(game);
  assert.equal(result.insolventSeasons, 0);
});

test('tickSeasonalEconomy: drought weather severity scales feed cost in ledger', () => {
  const baseGame = {
    day: 30,
    horses: [{ id: 'h1' }, { id: 'h2' }, { id: 'h3' }],
    hands: [],
    ledger: [],
  };
  const normal = tickSeasonalEconomy({ ...baseGame }, 1.0);
  const drought = tickSeasonalEconomy({ ...baseGame }, 1.6);
  const normalFeed = totalExpenses(normal.ledger.filter((e) => e.category === 'feed' ? [e] : []).flat());
  // Compare ledger entries
  const normalFeedEntries = normal.ledger.filter((e) => e.category === 'feed');
  const droughtFeedEntries = drought.ledger.filter((e) => e.category === 'feed');
  const normalTotal = normalFeedEntries.reduce((s, e) => s + Math.abs(e.amount), 0);
  const droughtTotal = droughtFeedEntries.reduce((s, e) => s + Math.abs(e.amount), 0);
  assert.ok(droughtTotal > normalTotal, `drought feed should be higher (normal=${normalTotal}, drought=${droughtTotal})`);
});

test('tickSeasonalEconomy: loans accrue interest', () => {
  const game = {
    day: 30,
    horses: [{ id: 'h1' }],
    hands: [],
    ledger: [],
    loans: [createLoan(10000, 0.10, 90, 1)], // 10% APR
  };
  const result = tickSeasonalEconomy(game);
  assert.equal(result.loans[0].remainingPrincipal, 10000 + Math.round(10000 * 0.10 / 365));
});

test('hayPriceMultiplier: 1.0 = normal, 1.6 = drought', () => {
  assert.equal(hayPriceMultiplier(1.0), 1.0);
  const drought = hayPriceMultiplier(1.6);
  assert.ok(drought > 1.0 && drought < 2.0, `drought multiplier should be > 1.0 and < 2.0 (got ${drought})`);
});

test('hayPriceMultiplier: caps at 2.5x for severe drought', () => {
  assert.equal(hayPriceMultiplier(10.0), 2.5);
});

test('horsePriceMultiplier: scales with horsemen corner', () => {
  assert.ok(horsePriceMultiplier(0) < horsePriceMultiplier(50));
  assert.ok(horsePriceMultiplier(50) < horsePriceMultiplier(100));
});

test('horsePriceMultiplier: 0% horsemen = 0.6x, 100% = 1.5x', () => {
  assert.equal(horsePriceMultiplier(0), 0.6);
  assert.equal(horsePriceMultiplier(100), 1.5);
});

test('fuelPriceMultiplier: returns 1.0 (stub)', () => {
  assert.equal(fuelPriceMultiplier(), 1.0);
});

test('createLoan: initializes a current loan', () => {
  const loan = createLoan(10000, 0.10, 90, 1);
  assert.equal(loan.principal, 10000);
  assert.equal(loan.interestRate, 0.10);
  assert.equal(loan.remainingPrincipal, 10000);
  assert.equal(loan.status, 'current');
  assert.equal(loan.daysSincePayment, 0);
});

test('maxLoanAvailable: matches loanTerms', () => {
  assert.equal(maxLoanAvailable(50), 60000);
  assert.equal(maxLoanAvailable(0), 0);
  assert.equal(maxLoanAvailable(95), 250000);
});

test('interestRateFor: matches loanTerms', () => {
  assert.equal(interestRateFor(50), 0.08);
  assert.equal(interestRateFor(95), 0.06);
  assert.ok(interestRateFor(10) > 0.15);
});

test('tickLoan: accrues daily interest', () => {
  const loan = createLoan(10000, 0.10, 90, 1);
  const ticked = tickLoan(loan);
  // 10000 × (0.10 / 365) = 2.74, rounded = 3
  assert.equal(ticked.interestAccrued, Math.round(10000 * 0.10 / 365));
  assert.equal(ticked.daysSincePayment, 1);
});

test('tickLoan: marks loan late after term days pass', () => {
  const loan = createLoan(1000, 0.10, 5, 1);
  let current = loan;
  for (let i = 0; i < 5; i++) {
    current = tickLoan(current);
  }
  // After 5 ticks, daysSincePayment = 5, term = 5, NOT > 5 yet
  assert.equal(current.status, 'current');
  // 6th tick triggers late
  current = tickLoan(current);
  assert.equal(current.status, 'late');
});

test('tickLoan: paid loan is not ticked', () => {
  const loan = { ...createLoan(1000, 0.10, 90, 1), status: 'paid' };
  const ticked = tickLoan(loan);
  assert.equal(ticked, loan);
});

test('repayLoan: pays down principal', () => {
  const loan = createLoan(10000, 0.10, 90, 1);
  const { loan: newLoan, amountToPrincipal } = repayLoan(loan, 3000);
  assert.equal(newLoan.remainingPrincipal, 7000);
  assert.equal(amountToPrincipal, 3000);
  assert.equal(newLoan.status, 'current');
  assert.equal(newLoan.daysSincePayment, 0);
});

test('repayLoan: paying off marks loan as paid', () => {
  const loan = createLoan(1000, 0.10, 90, 1);
  const { loan: newLoan } = repayLoan(loan, 1500);
  assert.equal(newLoan.remainingPrincipal, 0);
  assert.equal(newLoan.status, 'paid');
});

test('repayLoan: paid loan is idempotent', () => {
  const loan = createLoan(1000, 0.10, 90, 1);
  const first = repayLoan(loan, 1500);
  const second = repayLoan(first.loan, 500);
  assert.equal(second.amountToPrincipal, 0);
  assert.equal(second.loan.status, 'paid');
});

test('totalLoanDebt: sums unpaid loans', () => {
  const loans = [
    createLoan(1000, 0.10, 90, 1),
    createLoan(5000, 0.10, 90, 2),
    { ...createLoan(2000, 0.10, 90, 3), status: 'paid' },
  ];
  assert.equal(totalLoanDebt(loans), 6000);
});

test('isInsolvent: true after 3 seasons of negative cash', () => {
  const game = { insolventSeasons: 3 };
  assert.equal(isInsolvent(game), true);
});

test('isInsolvent: false at 2 seasons', () => {
  const game = { insolventSeasons: 2 };
  assert.equal(isInsolvent(game), false);
});

test('isInsolvent: handles missing field', () => {
  assert.equal(isInsolvent({}), false);
});

test('insolvencyWarning: null at 0 seasons', () => {
  assert.equal(insolvencyWarning(0), null);
});

test('insolvencyWarning: progressive severity', () => {
  const w1 = insolvencyWarning(1);
  const w2 = insolvencyWarning(2);
  const w3 = insolvencyWarning(3);
  assert.ok(w1.includes('watching') || w1.includes('tight'));
  assert.ok(w2.includes('twice') || w2.includes('auctioneer'));
  assert.ok(w3.includes('note') || w3.includes('truck'));
});