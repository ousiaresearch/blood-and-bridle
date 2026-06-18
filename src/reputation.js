// Blood & Bridle — four-cornered reputation.
//
// Sheridan's engine: a ranch has four standings, and they are not the
// same. A show ranch that wins every ribbon but is hated by the
// neighbors is a ranch with a *bad* reputation — its weakest corner
// is the binding constraint. McMurtry: the Hat Creek outfit is
// perpetually broke, but Gus and Call's name opens every door in
// Lonesome Dove. The corners explain the difference.
//
// Each corner: 0-100, independent. Collapse of any corner (0 for 3+
// seasons) triggers a unique ending variant (Phase 4.2).
//
// - HORSEMEN — AQHA, breeders, judges, show circuit. Horses perform,
//   word travels. Goes up with ribbons, down with bad sales, down
//   with scandals. The gate to the bigger shows.
// - COUNTRY — neighbors, the local ranching community, the
//   cattlemen's association. How you treat the land and the people.
//   Goes up with land improvements, neighbor help. Goes down when
//   your flood hits the neighbors' hay, when you fire a hand in
//   winter, when you sell the meadow to the developer.
// - BANK — lenders, the feed store, the implement dealer. Your
//   credit. Goes up with cash on hand and steady payment. Goes
//   down with missed payments, bounced checks, late wages.
// - CREW — Eli, Mae, Reyes, Elena, the day-workers. The people
//   who work for you. Goes up with steady wages, good horses, the
//   bunkhouse table. Goes down with injuries and deaths on the
//   job, with empty stalls in winter, with cruelty, with a hand
//   not getting paid.
//
// Pure module. No DOM. No localStorage.

export const REPUTATION_CORNERS = Object.freeze({
  horsemen: 'horsemen',
  country: 'country',
  bank: 'bank',
  crew: 'crew',
});

export const CORNER_LABELS = Object.freeze({
  horsemen: 'The Horsemen',
  country: 'The Country',
  bank: 'The Bank',
  crew: 'The Crew',
});

export const INITIAL_CORNER_VALUES = Object.freeze({
  horsemen: 38,    // new ranch, no standing at the circuit
  country: 50,     // the place is known, neither loved nor hated
  bank: 50,        // the bank is watching
  crew: 60,        // the hands gave you a chance
});

export const CORNER_THRESHOLDS = Object.freeze({
  COLLAPSED: 0,
  CRITICAL: 15,
  LOW: 30,
  MID: 50,
  HIGH: 70,
  EXCELLENT: 85,
});

// Adjust a single corner by delta. Returns new reputation object.
export function adjustCorner(reputation, corner, delta) {
  if (!REPUTATION_CORNERS[corner]) throw new Error(`Unknown reputation corner: ${corner}`);
  const current = reputation[corner] ?? 0;
  const next = Math.max(0, Math.min(100, current + delta));
  return { ...reputation, [corner]: next };
}

// Adjust multiple corners at once. `deltas` is { corner: delta }.
// Returns new reputation object.
export function adjustCorners(reputation, deltas) {
  let next = { ...reputation };
  for (const [corner, delta] of Object.entries(deltas)) {
    if (!REPUTATION_CORNERS[corner]) continue;
    const current = next[corner] ?? 0;
    next[corner] = Math.max(0, Math.min(100, current + delta));
  }
  return next;
}

// Overall reputation. The binding constraint is the *weakest* corner —
// in the West, your name is only as good as its weakest standing.
export function getOverallReputation(reputation) {
  if (!reputation) return 0;
  return Math.min(
    reputation.horsemen ?? 0,
    reputation.country ?? 0,
    reputation.bank ?? 0,
    reputation.crew ?? 0,
  );
}

// Returns the corner that has collapsed, or null. A corner is collapsed
// when its value is 0. (3-season grace period is tracked elsewhere —
// Phase 4.2.)
export function getCollapsedCorner(reputation) {
  if (!reputation) return null;
  for (const corner of Object.values(REPUTATION_CORNERS)) {
    if ((reputation[corner] ?? 0) <= 0) return corner;
  }
  return null;
}

// Threshold label for a corner's current value.
export function cornerThreshold(corner, value) {
  if (value <= 0) return 'collapsed';
  if (value < 15) return 'critical';
  if (value < 30) return 'low';
  if (value < 50) return 'mid';
  if (value < 70) return 'high';
  if (value < 85) return 'excellent';
  return 'renowned';
}

// McCarthy-style standing line for a corner. The line describes the
// *consequence* of the corner's value, not just the number.
export function cornerStandingLine(corner, value) {
  const v = value ?? 0;
  const lines = {
    horsemen: {
      collapsed: 'The horsemen have forgotten your name. You do not get invited back.',
      critical:  'The circuit does not return your calls. The judges look past your horse.',
      low:       'A bad word in the right ear is enough to cost you a sale.',
      mid:       'You are a name on a list, not on a banner.',
      high:      'A solid hand at the shows. No trophies. No embarrassments.',
      excellent: 'The judges look up when your horse walks in.',
      renowned:  'The circuit bends to your name.',
    },
    country: {
      collapsed: 'The country has shut its gate. You ride alone now.',
      critical:  'The neighbors cross the road when they see you coming.',
      low:       'You are not asked to brandings anymore.',
      mid:       'The country knows you. Does not know you well.',
      high:      'A fair neighbor. Pays his debts. Mends his fences.',
      excellent: 'Your brand opens doors. People say your name first.',
      renowned:  'The country is your country.',
    },
    bank: {
      collapsed: 'The bank has called the note. The line is closed.',
      critical:  'The bank will not lend another dollar. The feed store is on cash terms.',
      low:       'Credit is short. Terms are shorter.',
      mid:       'The bank is patient. For now.',
      high:      'A reliable borrower. The bank knows your voice.',
      excellent: 'The bank calls you before you call them.',
      renowned:  'You are the bank.',
    },
    crew: {
      collapsed: 'The hands have walked off the place. The bunkhouse is empty.',
      critical:  'The hands are looking for other work. The bunkhouse table is quiet.',
      low:       'Loyalty is thin. Wages are thinner.',
      mid:       'The hands work. They do not speak of you at the cafe.',
      high:      'The hands stay. Some seasons, all of them.',
      excellent: 'The hands would not work anywhere else.',
      renowned:  'Your hands are the ranch. The ranch is your hands.',
    },
  };
  return (lines[corner] ?? {})[cornerThreshold(corner, v)] ?? null;
}

// Build initial reputation corners object for a new game.
export function createInitialReputation() {
  return { ...INITIAL_CORNER_VALUES };
}

// Day-workers availability modifier. When the Country corner is high,
// more day-workers show up and they are skilled. When it is low, the
// drunks and the kids who steal are all you get.
//
// Returns a number 0-1: the probability that any given day-worker
// shows up on a given week. Used by Phase 1.5.
export function dayWorkerAvailability(countryCorner) {
  // 0% country → 0.2 availability, 100% country → 1.0 availability
  const v = countryCorner ?? 0;
  return 0.2 + (v / 100) * 0.8;
}

// Loan terms. The Bank corner governs the interest rate and the
// maximum loan size. Used by Phase 2.5.
//
// Returns { maxLoan, interestRate }. maxLoan is 0 when bank is
// collapsed. interestRate ranges 0.06 (renowned) to 0.18 (critical).
export function loanTerms(bankCorner) {
  const v = bankCorner ?? 0;
  if (v <= 0) return { maxLoan: 0, interestRate: 0.25, available: false };
  if (v < 15) return { maxLoan: 2000, interestRate: 0.18, available: true };
  if (v < 30) return { maxLoan: 8000, interestRate: 0.14, available: true };
  if (v < 50) return { maxLoan: 25000, interestRate: 0.10, available: true };
  if (v < 70) return { maxLoan: 60000, interestRate: 0.08, available: true };
  if (v < 85) return { maxLoan: 120000, interestRate: 0.07, available: true };
  return { maxLoan: 250000, interestRate: 0.06, available: true };
}

// Show circuit invitation gate. The Horsemen corner determines which
// shows you can enter. Used by Phase 2.3 (income streams) and shows.js.
//
// Returns the maximum prestige level (1-5) of shows you can enter.
// Prestige 5 = NCHA/NRCHA futurities. Renowned = 6 (invitation only).
export function showInvitationLevel(horsemenCorner) {
  const v = horsemenCorner ?? 0;
  if (v <= 0) return 0;
  if (v < 15) return 1;
  if (v < 30) return 1;
  if (v < 50) return 2;
  if (v < 70) return 3;
  if (v < 85) return 4;
  return 5;
}

// Crew departure risk. When the Crew corner is low, hands are at risk
// of leaving. Used by Phase 1.4 (labor) and Phase 4.1 (crisis moments).
//
// Returns a probability 0-1 that a hand will depart on a season
// boundary. Low crew = high risk. 0% crew = guaranteed departure.
export function crewDepartureRisk(crewCorner) {
  const v = crewCorner ?? 0;
  if (v <= 0) return 1.0;
  if (v < 15) return 0.4;
  if (v < 30) return 0.2;
  if (v < 50) return 0.05;
  if (v < 70) return 0.01;
  return 0.0;
}

// Recompute the legacy `game.reputation` from the four corners. The
// overall reputation is the minimum (binding constraint).
//
// Pure: returns a number. Caller is responsible for setting it on
// the game state.
export function recomputeOverallReputation(corners) {
  return getOverallReputation(corners);
}
