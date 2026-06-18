// Blood & Bridle — the ledger book.
//
// The book on the bunkhouse desk. Cormorant italic body, Rye day
// labels, parchment background. The book the foreman keeps. The
// numbers tell the story, the handwriting tells the season.
//
// Sheridan: "The ledger is the only honest book on the place."
//
// Pure module. No DOM. Builds the model that the renderer uses.

import { ledgerByCategory, totalIncome, totalExpenses } from './economy.js';

// Build the ledger book model. Returns the structured data for the
// renderer to consume. Includes:
//   - title (the ranch name, written in the handwriting of the season)
//   - season tallies (income vs expense per season)
//   - signature (the foreman's name, hand-style)
//   - parchment notes (McCarthy fragments at the season boundary)
//   - monthly summary (the most recent season's totals by category)
//
// Pure function. Game state in, model out.
export function buildLedgerBookModel(game) {
  const ledger = game.ledger ?? [];
  const groups = ledgerByCategory(ledger);

  // Income vs expense for the most recent season
  const recentDay = game.day ?? 0;
  const recentLedger = ledger.filter((e) => (e.day ?? 0) >= recentDay - 30);
  const income = totalIncome(recentLedger);
  const expense = totalExpenses(recentLedger);

  // Season tallies
  const seasonTallies = {};
  for (const e of ledger) {
    const season = e.season ?? 'Spring';
    if (!seasonTallies[season]) seasonTallies[season] = { income: 0, expense: 0, count: 0 };
    if (e.type === 'income') seasonTallies[season].income += e.amount;
    else seasonTallies[season].expense += Math.abs(e.amount);
    seasonTallies[season].count += 1;
  }

  // Signature: the foreman's name from staff
  const foreman = (game.staff ?? []).find((s) => s.id === 'mae')
    ?? (game.staff ?? [])[0]
    ?? { name: 'The Foreman' };

  // Recent entries (last 20)
  const recentEntries = ledger.slice(0, 20).map((e) => ({
    ...e,
    formattedAmount: e.type === 'income'
      ? `+$${e.amount.toLocaleString()}`
      : `-$${Math.abs(e.amount).toLocaleString()}`,
    signedLine: formatLedgerLine(e),
  }));

  // Category breakdown for the summary panel
  const categorySummary = Object.entries(groups).map(([category, data]) => ({
    category,
    income: data.income,
    expense: data.expense,
    net: data.income - data.expense,
    count: data.count,
  })).sort((a, b) => (b.income + b.expense) - (a.income + a.expense));

  // Parchment notes — McCarthy fragments at the season boundary
  const parchmentNote = generateParchmentNote(game);

  return {
    title: game.ranchName || 'The Ranch',
    brand: game.ranchBrand || null,
    season: game.season ?? 'Spring',
    year: Math.floor((game.day ?? 0) / 120) + 1,
    dayOfSeason: ((game.day ?? 0) % 120) + 1,
    foreman: { name: foreman.name, role: foreman.role ?? 'Foreman' },
    income,
    expense,
    net: income - expense,
    seasonTallies,
    recentEntries,
    categorySummary,
    parchmentNote,
    pageNumber: Math.floor((game.day ?? 0) / 30) + 1,
  };
}

// Format a ledger entry as a single McCarthy-style line.
// Example: "Feed for 6 horses: -$3,600. Day 30, Spring."
function formatLedgerLine(entry) {
  const sign = entry.type === 'income' ? '+' : '-';
  const amount = `$${Math.abs(entry.amount ?? 0).toLocaleString()}`;
  const note = entry.note ?? entry.category ?? '';
  const season = entry.season ?? '';
  const day = entry.day ?? 0;
  return `${note}: ${sign}${amount}. Day ${day}, ${season}.`;
}

// Generate a McCarthy-style parchment note for the season.
// Different seasons get different framings.
function generateParchmentNote(game) {
  const cash = game.cash ?? 0;
  const legacy = game.legacy ?? 0;
  const crew = game.reputationCorners?.crew ?? 50;
  const horsemen = game.reputationCorners?.horsemen ?? 50;
  const country = game.reputationCorners?.country ?? 50;
  const bank = game.reputationCorners?.bank ?? 50;

  // Highest corner is what the player is known for
  const corners = [
    { key: 'horsemen', val: horsemen, line: 'The horses perform. The circuit knows the name.' },
    { key: 'country', val: country, line: 'The neighbors speak well. The brand opens doors.' },
    { key: 'bank', val: bank, line: 'The bank calls before you call them.' },
    { key: 'crew', val: crew, line: 'The hands stay. They would not work anywhere else.' },
  ];
  const best = corners.reduce((a, b) => a.val >= b.val ? a : b);
  const worst = corners.reduce((a, b) => a.val <= b.val ? a : b);

  const fragments = [];

  if (cash < 0) {
    fragments.push('The bank book is in the red. The foreman does not say it out loud.');
  } else if (cash > 50000) {
    fragments.push('The cash drawer is heavy. It will not stay that way.');
  }

  if (legacy < 30) {
    fragments.push('The brand is thin. The neighbors forget.');
  }

  fragments.push(best.line);
  if (worst.val < 30 && worst.key !== best.key) {
    const worstLines = {
      horsemen: 'The circuit does not return the calls.',
      country: 'The country has shut its gate.',
      bank: 'The bank will not lend another dollar.',
      crew: 'The hands are looking for other work.',
    };
    fragments.push(worstLines[worst.key]);
  }

  return fragments.join(' ');
}

// Build a "page" of the ledger book — a summary view that the
// renderer turns into parchment. Returns a single page's worth.
export function buildLedgerPage(game, pageOffset = 0) {
  const model = buildLedgerBookModel(game);
  const allEntries = model.recentEntries;
  const pageSize = 12;
  const pageEntries = allEntries.slice(pageOffset * pageSize, (pageOffset + 1) * pageSize);

  return {
    ...model,
    pageEntries,
    totalPages: Math.ceil(allEntries.length / pageSize),
    currentPage: pageOffset + 1,
  };
}