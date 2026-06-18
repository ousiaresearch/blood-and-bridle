// Rival ranches. They buy, breed, and pressure the player in the region.
//
// Phase 12 — the canonical rivals are the family rivals from
// blood-family.js (William, Cobb, Edith, Henry Whitehorse). They are
// portraitId-linked to the Codex-generated mood portraits via
// src/rival-portraits.js. The cash/reputation/herd fields drive the
// existing tickRivals() / recordRivalPurchase() growth system, and
// these rivals also show up at auction (auction.js bidder-* ids) and
// in the community panel (community.js neighbor-* ids).
//
// Pure module. No DOM. No localStorage.

export const RIVALS = [
  {
    id: 'william-blood',
    name: 'William Blood',
    focus: 'show-circuit',
    parcel: 'show-grounds',
    family: true,
    portraitId: 'william-blood', // Phase 12 — mood chosen at render time
    herd: ['williams-colt-1'],
    reputation: 84,
    cash: 110000,
  },
  {
    id: 'cobb-blood',
    name: 'Cobb Blood',
    focus: 'dispersaler',
    parcel: 'cedar-draw',
    family: true,
    portraitId: 'cobb-blood', // Phase 12 — mood chosen at render time
    herd: ['cobbs-mare-1', 'cobbs-mare-2'],
    reputation: 68,
    cash: 55000,
  },
  {
    id: 'edith-crane',
    name: 'Edith Crane',
    focus: 'cattle',
    parcel: 'north-ridge',
    family: true,
    portraitId: 'edith-crane', // Phase 12 — mood chosen at render time
    herd: ['cranes-heifer-1'],
    reputation: 71,
    cash: 78000,
  },
  {
    id: 'henry-whitehorse',
    name: 'Henry Whitehorse',
    focus: 'working-ranch',
    parcel: null, // tribal land
    family: false,
    portraitId: 'henry-whitehorse', // Phase 12 — mood chosen at render time
    herd: ['ash-coulee-colt-1', 'ash-coulee-mare-1'],
    reputation: 76,
    cash: 92000,
  },
];

// Each season, rivals grow. Buying power rises with reputation.
// Family rivals grow a little slower (they're not running a business,
// they're holding a ranch) but their reputation is more resilient.
export function tickRivals(game) {
  for (const rival of RIVALS) {
    const growthRate = rival.family ? 1.025 : 1.04;
    rival.cash = Math.round(rival.cash * growthRate);
    const repGainChance = rival.family ? 0.10 : 0.18;
    if (Math.random() < repGainChance) rival.reputation = Math.min(100, rival.reputation + 1);
  }
  return game;
}

// When the player loses an auction, the rival is recorded as the buyer.
export function recordRivalPurchase(rivalId, horseId, price) {
  const rival = RIVALS.find((r) => r.id === rivalId);
  if (!rival) return;
  rival.herd.push(horseId);
  rival.cash -= price;
}

export function getRival(id) {
  return RIVALS.find((r) => r.id === id);
}

// Get the rival record for a given id (canonical or alias).
// Accepts: 'william-blood', 'bidder-cobb', 'neighbor-ash-coulee', etc.
export function getRivalByAnyId(anyId) {
  return RIVALS.find((r) => r.id === anyId) ?? null;
}