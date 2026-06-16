// Mid-term contracts. The ranch's reason to look 30+ days ahead.
// Two flavors: board commitments (monthly income for a fixed period)
// and sale reservations (a future sale locked in today).

export const BOARD_TEMPLATES = [
  { duration: 30, monthlyFee: 1100, horseRequirement: 'any', label: 'Pleasure horse board' },
  { duration: 60, monthlyFee: 1500, horseRequirement: 'campaigner', label: 'Campaigner board' },
  { duration: 90, monthlyFee: 1800, horseRequirement: 'reining_or_cutting', label: 'Show-stable board' },
];

export const SALE_TEMPLATES = [
  { lockDays: 60, priceMultiplier: 1.1, label: 'Standard reservation' },
  { lockDays: 90, priceMultiplier: 1.18, label: 'Premium reservation' },
  { lockDays: 120, priceMultiplier: 1.25, label: 'Forward sale' },
];

// Generate a contract offer based on game state. Returns null if no offer this tick.
export function generateContractOffer(game, rng = Math.random) {
  // Roughly every 30 in-game days (every season), a buyer appears
  if (game.day % 30 !== 0) return null;
  // Don't generate if we already have 3+ active contracts
  if ((game.contracts ?? []).length >= 3) return null;

  // Pick board or sale with 60/40 odds
  if (rng() < 0.6) {
    const template = BOARD_TEMPLATES[Math.floor(rng() * BOARD_TEMPLATES.length)];
    return {
      id: `board-${game.day}-${Math.floor(rng() * 1000)}`,
      type: 'board',
      template: template.label,
      duration: template.duration,
      monthlyFee: template.monthlyFee,
      totalValue: template.monthlyFee * (template.duration / 30),
      daysRemaining: template.duration,
      createdDay: game.day,
      horseRequirement: template.horseRequirement,
    };
  } else {
    const template = SALE_TEMPLATES[Math.floor(rng() * SALE_TEMPLATES.length)];
    const candidateHorses = game.horses.filter((h) => h.age >= 4 && h.age <= 12);
    if (candidateHorses.length === 0) return null;
    const horse = candidateHorses[Math.floor(rng() * candidateHorses.length)];
    const price = Math.round(horse.value * template.priceMultiplier);
    return {
      id: `sale-${game.day}-${Math.floor(rng() * 1000)}`,
      type: 'sale',
      template: template.label,
      horseId: horse.id,
      horseName: horse.name,
      lockDays: template.lockDays,
      price,
      daysRemaining: template.lockDays,
      createdDay: game.day,
    };
  }
}

export function acceptContract(game, contractId) {
  const contract = (game.contracts ?? []).find((c) => c.id === contractId);
  if (!contract) throw new Error('Contract not found.');
  if (contract.type === 'sale') {
    if (!game.horses.find((h) => h.id === contract.horseId)) throw new Error(`${contract.horseName} is no longer in your herd.`);
  }
  return {
    ...game,
    contracts: game.contracts.map((c) => c.id === contractId ? { ...c, status: 'active' } : c),
    log: [`Accepted ${contract.template} contract (${contract.id}).`, ...game.log].slice(0, 20),
  };
}

export function declineContract(game, contractId) {
  return {
    ...game,
    contracts: (game.contracts ?? []).filter((c) => c.id !== contractId),
    log: [`Declined ${contractId}.`, ...game.log].slice(0, 20),
  };
}

// Tick contracts. Returns updated game + any payouts or sales to apply.
export function tickContracts(game) {
  let cash = 0;
  let horses = game.horses;
  const completedIds = [];
  const completedDetails = new Map();
  const updated = (game.contracts ?? []).map((c) => {
    if (c.status === 'pending') return c;
    // Monthly board payouts: triggered when the current daysRemaining is a multiple of 30
    if (c.type === 'board' && c.daysRemaining > 0 && c.daysRemaining % 30 === 0) {
      cash += c.monthlyFee;
    }
    const next = { ...c, daysRemaining: c.daysRemaining - 1 };
    if (next.daysRemaining <= 0) {
      completedIds.push(next.id);
      completedDetails.set(next.id, next);
    }
    return next;
  });

  // Process completions
  for (const id of completedIds) {
    const c = completedDetails.get(id);
    if (c.type === 'sale') {
      const horse = horses.find((h) => h.id === c.horseId);
      if (horse) {
        cash += c.price;
        horses = horses.filter((h) => h.id !== c.horseId);
      }
    }
  }

  return {
    game: {
      ...game,
      cash: game.cash + cash,
      horses,
      contracts: updated.filter((c) => c.daysRemaining > 0),
    },
    payouts: cash,
    completed: completedIds,
  };
}
