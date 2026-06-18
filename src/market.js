// Blood & Bridle — Market as a place (Phase 5 deepening).
//
// The market is not a price. The market is people. The auctioneer
// knows your name. The killer buyer is the man who offers cash for
// horses that won't make the cut. The trader always has horses for
// sale, never any you asked for. The order buyer is the agent for
// a wealthy client, offers more than anyone, never remembers your
// name. The dispersal sale is when a neighbor dies and the whole
// herd goes.
//
// Pure module. No DOM. No localStorage.

export const BUYER_TYPES = Object.freeze({
  KILLER_BUYER: 'killer_buyer',
  TRADER: 'trader',
  ORDER_BUYER: 'order_buyer',
  PRIVATE: 'private',
  DISPERSAL: 'dispersal',
});

// Each buyer has a name, personality, and offer profile.
export const BUYER_DEFS = Object.freeze([
  {
    id: 'killer-buyer',
    name: 'Delbert Hask',
    type: BUYER_TYPES.KILLER_BUYER,
    description: 'The killer buyer. Offers cash for horses that won\'t make the cut. The trucks leave at dawn.',
    offerMultiplier: 0.45,           // pays 45% of value
    preferredAges: [12, 13, 14, 15],  // wants older horses
    preferredCondition: 'tired',
    reputationEffect: { horsemen: -3, country: -2 },
  },
  {
    id: 'trader',
    name: 'Wendell Polk',
    type: BUYER_TYPES.TRADER,
    description: 'The trader. Always has horses for sale, never any you asked for.',
    offerMultiplier: 0.85,
    preferredAges: [4, 5, 6, 7, 8],
    preferredCondition: 'sound',
    reputationEffect: { horsemen: 1 },
  },
  {
    id: 'order-buyer',
    name: 'A buyer from Fort Worth',
    type: BUYER_TYPES.ORDER_BUYER,
    description: 'An agent for a wealthy client. Offers more than anyone. Never remembers your name.',
    offerMultiplier: 1.35,           // pays 135% of value
    preferredAges: [2, 3, 4, 5],
    preferredCondition: 'sound',
    reputationEffect: { horsemen: 3, bank: 1 },
  },
  {
    id: 'private-treaty',
    name: 'A neighbor at the kitchen table',
    type: BUYER_TYPES.PRIVATE,
    description: 'A private sale. Cash on the barrelhead. The neighbor remembers your name.',
    offerMultiplier: 1.0,
    preferredAges: [3, 4, 5, 6, 7, 8, 9],
    preferredCondition: 'sound',
    reputationEffect: { country: 2, horsemen: 1 },
  },
]);

// Get the buyer for a given horse, based on the horse's age and condition.
// Returns the most appropriate buyer, or null if no buyer wants it.
export function findBuyer(horse, horsemenCorner = 50) {
  const eligible = BUYER_DEFS.filter((b) => {
    if (!b.preferredAges.includes(horse.age ?? 0)) return false;
    if (b.preferredCondition === 'tired' && (horse.health ?? 100) > 60) return false;
    if (b.preferredCondition === 'sound' && (horse.health ?? 100) < 40) return false;
    return true;
  });
  if (eligible.length === 0) {
    // Fallback: any private buyer
    return BUYER_DEFS.find((b) => b.type === BUYER_TYPES.PRIVATE) ?? BUYER_DEFS[0];
  }
  // Pick the buyer with the highest offer multiplier who is eligible
  // (high horsemen corner unlocks the order buyer)
  if (horsemenCorner >= 60) {
    const orderBuyer = eligible.find((b) => b.type === BUYER_TYPES.ORDER_BUYER);
    if (orderBuyer) return orderBuyer;
  }
  return eligible.sort((a, b) => b.offerMultiplier - a.offerMultiplier)[0];
}

// Compute the offer for a horse at the market.
export function marketOffer(horse, buyer, basePrice = null) {
  const value = basePrice ?? horse.value ?? 5000;
  const baseOffer = Math.round(value * (buyer.offerMultiplier ?? 1.0));
  // Apply a small random variance (±5%)
  const variance = 1 + (Math.random() - 0.5) * 0.1;
  return Math.round(baseOffer * variance);
}

// The dispersal sale: when a neighbor dies and the whole herd goes.
// Returns an array of synthetic horses that the neighbor's estate
// is selling, with prices and quality.
export function dispersalSale(neighborName, herdSize = 8) {
  const horses = [];
  for (let i = 0; i < herdSize; i++) {
    const age = 4 + Math.floor(Math.random() * 8);
    const value = 3000 + age * 800;
    horses.push({
      id: `dispersal-${neighborName}-${i}`,
      name: `${neighborName}'s #${i + 1}`,
      age,
      value,
      breed: 'quarter_horse',
      description: `From the ${neighborName} dispersal. Honest horse, no papers.`,
    });
  }
  return horses;
}

// Market sentiment: scales with the horsemen corner.
// At 0% horsemen, no one is buying. At 100%, buyers are bidding
// against each other.
export function marketSentiment(horsemenCorner) {
  const v = horsemenCorner ?? 50;
  if (v < 15) return { activity: 'dead', offerMult: 0.6 };
  if (v < 30) return { activity: 'quiet', offerMult: 0.75 };
  if (v < 50) return { activity: 'steady', offerMult: 0.95 };
  if (v < 70) return { activity: 'busy', offerMult: 1.15 };
  if (v < 85) return { activity: 'hot', offerMult: 1.30 };
  return { activity: 'boiling', offerMult: 1.50 };
}