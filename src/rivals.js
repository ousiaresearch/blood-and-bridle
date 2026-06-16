// Rival ranches. They buy, breed, and pressure the player in the region.

export const RIVALS = [
  {
    id: 'callahan',
    name: 'Callahan Ranch',
    focus: 'reining',
    herd: ['callahan-mare-1', 'callahan-stallion-1'],
    reputation: 78,
    cash: 95000,
  },
  {
    id: 'skogstad',
    name: 'Skogstad & Daughters',
    focus: 'cutting',
    herd: ['skogstad-1', 'skogstad-2'],
    reputation: 71,
    cash: 60000,
  },
];

// Each season, rivals grow. Buying power rises with reputation.
export function tickRivals(game) {
  for (const rival of RIVALS) {
    rival.cash = Math.round(rival.cash * 1.04);
    if (Math.random() < 0.18) rival.reputation = Math.min(100, rival.reputation + 1);
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
