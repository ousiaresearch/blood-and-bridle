// Auction house. Three personality-driven bidders compete on each listing.
// Each bidder has a budget, taste profile, and ceiling for each trait.
export const BIDDERS = [
  {
    id: 'bidder-amaya',
    name: 'Amaya Quintero',
    archetype: 'trainer',
    budget: 22000,
    taste: { gait_quality: 0.9, temperament_stability: 0.7, heart: 0.5, bone_density: 0.4, conformation: 0.6 },
  },
  {
    id: 'bidder-tillman',
    name: 'Tillman & Co.',
    archetype: 'syndicate',
    budget: 55000,
    taste: { gait_quality: 0.6, temperament_stability: 0.4, heart: 0.5, bone_density: 0.5, conformation: 0.9 },
  },
  {
    id: 'bidder-hauser',
    name: 'Mrs. Hauser',
    archetype: 'amateur',
    budget: 14000,
    taste: { gait_quality: 0.3, temperament_stability: 0.95, heart: 0.6, bone_density: 0.3, conformation: 0.4 },
  },
  {
    id: 'bidder-rivera',
    name: 'Rivera Performance Horses',
    archetype: 'show-circuit',
    budget: 38000,
    taste: { gait_quality: 0.85, temperament_stability: 0.5, heart: 0.85, bone_density: 0.6, conformation: 0.7 },
  },
  {
    // Phase 10 — the cousin. Runs a small dispersaler operation out of
    // the creek parcel. Pays fair, doesn't haggle on quality.
    id: 'bidder-cobb',
    name: 'Cobb Blood',
    archetype: 'dispersaler',
    budget: 18000,
    taste: { gait_quality: 0.5, temperament_stability: 0.8, heart: 0.7, bone_density: 0.7, conformation: 0.5 },
  },
  {
    // Phase 10 — the Ash Coulee foreman. He buys for the tribal
    // operation. Working-ranch taste, fair prices.
    id: 'bidder-whitehorse',
    name: 'Henry Whitehorse',
    archetype: 'working-ranch',
    budget: 24000,
    taste: { gait_quality: 0.4, temperament_stability: 0.9, heart: 0.6, bone_density: 0.8, conformation: 0.5 },
  },
];

// Score a horse against a bidder. Higher score = willing to pay more.
export function scoreHorseForBidder(horse, bidder) {
  let score = 0;
  let weightSum = 0;
  for (const [trait, weight] of Object.entries(bidder.taste)) {
    const value = horse.traits?.[trait] ?? 50;
    score += value * weight;
    weightSum += weight;
  }
  // Aggressive bidders pay more for the same horse.
  return (score / weightSum) * (0.6 + (bidder.budget / 60000));
}

// Auction a horse: pick the highest-scoring bidder within their budget.
export function runAuction(horse) {
  const bids = BIDDERS
    .map((b) => ({ bidder: b, offer: scoreHorseForBidder(horse, b) }))
    .map(({ bidder, offer }) => ({
      ...bidder,
      offer: Math.min(bidder.budget, Math.round(offer * 80)), // translate trait score to dollars
    }))
    .sort((a, b) => b.offer - a.offer);

  return { topBid: bids[0], runnerUp: bids[1], allBids: bids };
}

export function listBidder(id) {
  return BIDDERS.find((b) => b.id === id);
}
