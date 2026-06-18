// Blood & Bridle — economy.
//
// Seasonal cash flow. The calendar has shape:
// - Spring: trough. Foaling, farrier, vet bills, no income.
// - Summer: show circuit, training fees, boarders, equipment maintenance.
// - Fall: peak. Sales, hay harvest, stud fees, farrier again.
// - Winter: no income. Hay feeding (highest cost), property tax.
//
// Every expense and income is tracked in an immutable ledger. The
// ledger is the historical record of the ranch's life. Commodity
// volatility (hay, fuel, horse prices) responds to weather and
// reputation. Credit is governed by the Bank corner.
//
// McMurtry: Gus and Call never had a budget, but they had a
// calendar — and the calendar killed them when they forgot it.
//
// Pure module. No DOM. No localStorage.

import { getSeason } from './seasons.js';
import { loanTerms } from './reputation.js';

export const EXPENSE_CATEGORIES = Object.freeze({
  FEED: 'feed',
  VETERINARY: 'veterinary',
  FARRIER: 'farrier',
  WAGES: 'wages',
  FUEL: 'fuel',
  EQUIPMENT: 'equipment',
  PROPERTY_TAX: 'property_tax',
  INSURANCE: 'insurance',
  HAZARD: 'hazard',
  DAY_WORKER: 'day_worker',
  INTEREST: 'interest',
  IMPROVEMENT: 'improvement',
  OTHER: 'other',
});

export const INCOME_CATEGORIES = Object.freeze({
  HORSE_SALE: 'horse_sale',
  AUCTION_SALE: 'auction_sale',
  STUD_FEE: 'stud_fee',
  SHOW_WINNINGS: 'show_winnings',
  BOARDING: 'boarding',
  TRAINING_FEE: 'training_fee',
  HAY_HARVEST: 'hay_harvest',
  GRAZING_LEASE: 'grazing_lease',
  CONTRACT_PAYOUT: 'contract_payout',
  LOAN_DISBURSEMENT: 'loan_disbursement',
  INSURANCE_CLAIM: 'insurance_claim',
  DEVELOPER_SALE: 'developer_sale',
  OTHER: 'other',
});

// Base monthly fixed costs (per horse or per hand, depending on type).
// These are the *unavoidable* costs of running a ranch — what keeps
// the lights on even if no one is showing, selling, or breeding.
export const BASE_MONTHLY = Object.freeze({
  feed_per_horse: 600,
  farrier_per_horse: 90,        // $90/horse × 2 visits per quarter
  fuel_base: 200,
  equipment_quarterly: 800,
  property_tax_annual: 4800,
  insurance_quarterly: 1200,
  // Hands (per month)
  hand_wage_average: 2000,
});

// Seasonal multipliers on top of base monthly costs.
export const SEASONAL_EXPENSE_MULTIPLIER = Object.freeze({
  Spring: { feed: 1.05, farrier: 1.0, fuel: 0.85, equipment: 0.5 },  // farrier visits, foaling prep
  Summer: { feed: 0.85, farrier: 1.0, fuel: 1.15, equipment: 1.5 },  // show season, equipment break
  Fall:   { feed: 0.90, farrier: 1.0, fuel: 1.40, equipment: 0.5 },  // harvest runs, second farrier
  Winter: { feed: 1.40, farrier: 0.5, fuel: 1.05, equipment: 0.5 },  // hay feeding, no trips
});

// Base hay price per "unit" (a feed-unit is roughly a horse-week of hay).
// Real-world hay is sold by the ton; in this abstraction, it's per-horse-month.
export const HAY_BASE_PRICE = 200;

// ---- Ledger primitives ----

export function createInitialLedger() {
  return [];
}

export function addExpense(ledger, entry) {
  return [
    {
      ...entry,
      type: 'expense',
      day: entry.day ?? 0,
      season: entry.season ?? 'Spring',
      amount: -Math.abs(entry.amount ?? 0), // expenses are negative
    },
    ...ledger,
  ].slice(0, 200);
}

export function addIncome(ledger, entry) {
  return [
    {
      ...entry,
      type: 'income',
      day: entry.day ?? 0,
      season: entry.season ?? 'Spring',
      amount: Math.abs(entry.amount ?? 0), // income is positive
    },
    ...ledger,
  ].slice(0, 200);
}

export function totalExpenses(ledger, since = 0) {
  return ledger
    .filter((e) => e.type === 'expense' && (e.day ?? 0) >= since)
    .reduce((sum, e) => sum + Math.abs(e.amount ?? 0), 0);
}

export function totalIncome(ledger, since = 0) {
  return ledger
    .filter((e) => e.type === 'income' && (e.day ?? 0) >= since)
    .reduce((sum, e) => sum + Math.abs(e.amount ?? 0), 0);
}

export function netCashFlow(ledger, since = 0) {
  return totalIncome(ledger, since) - totalExpenses(ledger, since);
}

// Group ledger entries by category for a summary view.
export function ledgerByCategory(ledger) {
  const groups = {};
  for (const e of ledger) {
    const cat = e.category ?? 'other';
    if (!groups[cat]) groups[cat] = { income: 0, expense: 0, count: 0 };
    if (e.type === 'income') groups[cat].income += e.amount;
    else if (e.type === 'expense') groups[cat].expense += Math.abs(e.amount);
    groups[cat].count++;
  }
  return groups;
}

// ---- Seasonal expense / income calculation ----

// Compute this-season's *scheduled* expenses (feed, wages, farrier if
// spring/fall, property tax if winter, etc.). Returns an array of
// ledger entries ready to add.
//
// weatherSeverity: multiplier from the global disaster system.
// horsemenCorner: drives hay harvest income, grazing lease income.
export function computeSeasonalExpenses(game, season, weatherSeverity = 1.0) {
  const expenses = [];
  const horseCount = game.horses?.length ?? 0;
  const handCount = (game.hands ?? [])
    .filter((h) => !h.perCall && h.status !== 'gone').length;
  const mult = SEASONAL_EXPENSE_MULTIPLIER[season] ?? SEASONAL_EXPENSE_MULTIPLIER.Spring;

  // Feed (every season). Hay price spikes in drought years.
  const hayMult = hayPriceMultiplier(weatherSeverity);
  const feed = Math.round(horseCount * BASE_MONTHLY.feed_per_horse * (mult.feed ?? 1) * hayMult);
  expenses.push({
    category: EXPENSE_CATEGORIES.FEED,
    amount: feed,
    season,
    day: game.day,
    note: `Feed for ${horseCount} horse${horseCount === 1 ? '' : 's'}${hayMult > 1.15 ? ` (hay price ${Math.round(hayMult * 100)}%)` : ''}`,
  });

  // Wages (every season). Hand wage × number of working hands.
  const wages = Math.round(handCount * BASE_MONTHLY.hand_wage_average * 0.25);  // quarterly
  if (wages > 0) {
    expenses.push({
      category: EXPENSE_CATEGORIES.WAGES,
      amount: wages,
      season,
      day: game.day,
      note: `Wages for ${handCount} hand${handCount === 1 ? '' : 's'}`,
    });
  }

  // Fuel (every season).
  const fuel = Math.round(BASE_MONTHLY.fuel_base * (mult.fuel ?? 1));
  expenses.push({
    category: EXPENSE_CATEGORIES.FUEL,
    amount: fuel,
    season,
    day: game.day,
    note: `Fuel and truck`,
  });

  // Farrier (spring and fall — every 6 weeks).
  if (season === 'Spring' || season === 'Fall') {
    const farrier = Math.round(horseCount * BASE_MONTHLY.farrier_per_horse * (mult.farrier ?? 1));
    expenses.push({
      category: EXPENSE_CATEGORIES.FARRIER,
      amount: farrier,
      season,
      day: game.day,
      note: `Farrier visit (${horseCount} horse${horseCount === 1 ? '' : 's'})`,
    });
  }

  // Equipment (summer — when things break).
  if (season === 'Summer') {
    const equip = Math.round(BASE_MONTHLY.equipment_quarterly * (mult.equipment ?? 1) * 0.5);
    expenses.push({
      category: EXPENSE_CATEGORIES.EQUIPMENT,
      amount: equip,
      season,
      day: game.day,
      note: 'Equipment maintenance',
    });
  }

  // Property tax (winter — quarterly installment).
  if (season === 'Winter') {
    const tax = Math.round(BASE_MONTHLY.property_tax_annual / 4);
    expenses.push({
      category: EXPENSE_CATEGORIES.PROPERTY_TAX,
      amount: tax,
      season,
      day: game.day,
      note: 'County property tax',
    });
  }

  // Insurance (every season if enabled).
  if (game.insuranceEnabled) {
    const ins = Math.round(BASE_MONTHLY.insurance_quarterly * 0.25);
    expenses.push({
      category: EXPENSE_CATEGORIES.INSURANCE,
      amount: ins,
      season,
      day: game.day,
      note: 'Insurance premium',
    });
  }

  return expenses;
}

// Compute this-season's *scheduled* income streams.
export function computeSeasonalIncome(game, season) {
  const income = [];

  // Grazing lease (spring, only if horsemen corner is 50+ — prestige gate).
  if (season === 'Spring' && (game.reputationCorners?.horsemen ?? 0) >= 50) {
    income.push({
      category: INCOME_CATEGORIES.GRAZING_LEASE,
      amount: 1500,
      season,
      day: game.day,
      note: 'Forest Service grazing lease',
    });
  }

  // Hay harvest (fall, only if there's a hay field — currently stubbed).
  if (season === 'Fall' && game.parcels?.some((p) => p.improvement === 'irrigated')) {
    income.push({
      category: INCOME_CATEGORIES.HAY_HARVEST,
      amount: 800,
      season,
      day: game.day,
      note: 'Hay harvest from irrigated home pasture',
    });
  }

  // Stud fee (fall, only if a stallion is on the place and bonded).
  if (season === 'Fall' && game.stallionId && game.stallionBonded) {
    income.push({
      category: INCOME_CATEGORIES.STUD_FEE,
      amount: 2500,
      season,
      day: game.day,
      note: `Stud fee for ${game.stallionId}`,
    });
  }

  return income;
}

// Tick the seasonal economy. Returns:
//   { game, ledger, cashDelta, logLines, insolventSeasons }
//
// Pure: doesn't mutate. The caller applies cashDelta and updates the
// game state with the new ledger and insolventSeasons.
export function tickSeasonalEconomy(game, weatherSeverity = 1.0) {
  const season = getSeason(game);
  const expenses = computeSeasonalExpenses(game, season, weatherSeverity);
  const incomeEntries = computeSeasonalIncome(game, season);

  let ledger = game.ledger ?? [];
  let cashDelta = 0;
  const logLines = [];

  for (const e of expenses) {
    ledger = addExpense(ledger, { ...e, day: game.day });
    cashDelta -= e.amount;
    // Only log the bigger ones
    if (e.amount >= 800) {
      logLines.push(`${e.note}: $${e.amount.toLocaleString()}.`);
    }
  }

  for (const i of incomeEntries) {
    ledger = addIncome(ledger, { ...i, day: game.day });
    cashDelta += i.amount;
    logLines.push(`${i.note}: $${i.amount.toLocaleString()}.`);
  }

  // Loan interest accrual
  const loans = game.loans ?? [];
  let totalInterest = 0;
  const newLoans = [];
  for (const loan of loans) {
    if (loan.status === 'paid') {
      newLoans.push(loan);
      continue;
    }
    const ticked = tickLoan(loan);
    newLoans.push(ticked);
    if (ticked.interestAccrued > 0) {
      totalInterest += ticked.interestAccrued;
      ledger = addExpense(ledger, {
        category: EXPENSE_CATEGORIES.INTEREST,
        amount: ticked.interestAccrued,
        season,
        day: game.day,
        note: `Interest on loan (${(ticked.interestRate * 100).toFixed(1)}% APR)`,
      });
      cashDelta -= ticked.interestAccrued;
    }
  }

  // Insolvency tracking
  const newCash = (game.cash ?? 0) + cashDelta;
  const insolventThreshold = -1000;
  let newInsolventSeasons = game.insolventSeasons ?? 0;
  if (newCash < insolventThreshold) {
    newInsolventSeasons += 1;
  } else {
    newInsolventSeasons = 0;
  }

  return {
    ledger,
    loans: newLoans,
    cashDelta,
    logLines,
    insolventSeasons: newInsolventSeasons,
    expenses,
    income: incomeEntries,
    totalInterest,
  };
}

// ---- Commodity volatility ----

// Hay price multiplier based on weather severity.
// 1.0 = normal, 1.6 = drought year, 2.0+ = hard drought.
export function hayPriceMultiplier(weatherSeverity) {
  if (weatherSeverity <= 1.0) return 1.0;
  // Linear scaling: 1.0 severity = 1.0x, 2.0 severity = 1.6x
  return Math.min(2.5, 1.0 + (weatherSeverity - 1.0) * 0.6);
}

// Horse sale price multiplier based on horsemen corner.
// 0% horsemen = 0.6x, 50% = 1.0x, 100% = 1.5x.
export function horsePriceMultiplier(horsemenCorner) {
  return 0.6 + ((horsemenCorner ?? 0) / 100) * 0.9;
}

// Fuel price multiplier (stub — could vary with politics/season later).
export function fuelPriceMultiplier() {
  return 1.0;
}

// ---- Loans ----

// Create a new loan.
export function createLoan(principal, interestRate, termDays, day) {
  return {
    id: `loan-${day}-${Math.random().toString(36).slice(2, 8)}`,
    principal,
    interestRate,            // annual rate, e.g. 0.10 = 10% APR
    termDays,                // payment due every N days
    remainingPrincipal: principal,
    daysSincePayment: 0,
    day,                     // day loan was originated
    status: 'current',       // 'current' | 'late' | 'defaulted' | 'paid'
    interestAccrued: 0,      // last tick's accrued interest (for ledger)
    totalInterestPaid: 0,
    totalPrincipalPaid: 0,
  };
}

// Compute the maximum loan available at the current Bank corner.
export function maxLoanAvailable(bankCorner) {
  return loanTerms(bankCorner).maxLoan;
}

// Compute the interest rate at the current Bank corner.
export function interestRateFor(bankCorner) {
  return loanTerms(bankCorner).interestRate;
}

// Tick loan: accrue daily interest, mark late if past term.
// Returns { ...loan, interestAccrued: <this tick's interest> }.
export function tickLoan(loan) {
  if (loan.status === 'paid') return loan;
  // Daily rate from annual rate
  const dailyRate = loan.interestRate / 365;
  const interest = Math.round(loan.remainingPrincipal * dailyRate);
  const newPrincipal = loan.remainingPrincipal + interest;
  const newDaysSince = loan.daysSincePayment + 1;
  let newStatus = loan.status;
  if (newDaysSince > loan.termDays && newPrincipal > 0) {
    newStatus = 'late';
  }
  return {
    ...loan,
    remainingPrincipal: newPrincipal,
    daysSincePayment: newDaysSince,
    status: newStatus,
    interestAccrued: interest,
  };
}

// Make a loan payment. Returns { loan, amountToPrincipal, amountToInterest }.
// Pure: caller is responsible for deducting cash.
export function repayLoan(loan, amount) {
  if (loan.status === 'paid') {
    return { loan, amountToPrincipal: 0, amountToInterest: 0 };
  }
  // Interest is computed daily on the principal. For simplicity, we
  // assume the entire payment goes to principal (and the next tick
  // will accrue interest on the new balance).
  const payment = Math.min(amount, loan.remainingPrincipal);
  const newPrincipal = loan.remainingPrincipal - payment;
  return {
    loan: {
      ...loan,
      remainingPrincipal: newPrincipal,
      daysSincePayment: 0,
      status: newPrincipal <= 0 ? 'paid' : 'current',
      totalPrincipalPaid: loan.totalPrincipalPaid + payment,
    },
    amountToPrincipal: payment,
    amountToInterest: 0,
  };
}

// Total outstanding loan principal across all loans.
export function totalLoanDebt(loans) {
  return (loans ?? [])
    .filter((l) => l.status !== 'paid')
    .reduce((sum, l) => sum + l.remainingPrincipal, 0);
}

// ---- Insolvency ----

// True if cash has been below threshold for 3+ consecutive seasons.
export function isInsolvent(game) {
  return (game.insolventSeasons ?? 0) >= 3;
}

// McCarthy-style insolvency warning line.
export function insolvencyWarning(insolventSeasons) {
  if (insolventSeasons <= 0) return null;
  if (insolventSeasons === 1) return 'The bank is watching the books. The numbers are tight.';
  if (insolventSeasons === 2) return 'The bank has called twice. The auctioneer knows your name.';
  return 'The bank has called the note. The horses are going on the truck.';
}