// Blood & Bridle — the moral economy.
//
// The real choices. The ones that aren't obviously right or wrong.
// Skip the farrier this season and save $200, or pay and the foals
// don't get foot-rot. Delay Eli's wages and save $300, or pay and
// he doesn't quit. Skip the property tax and save $2000, or pay and
// the IRS doesn't take the ranch.
//
// The choices are not bugs. The choices are the game.
//
// Pure module. No DOM. No localStorage.

import { EXPENSE_CATEGORIES } from './economy.js';

// Categories that can be skipped. Each has a delayed consequence.
export const MORAL_CATEGORIES = Object.freeze({
  FARRIER: 'farrier',
  WAGES: 'wages',
  PROPERTY_TAX: 'property_tax',
  VETERINARY: 'veterinary',
});

// Consequences of skipping an obligation. Each has:
//   - immediateEffect: what happens right away
//   - delayedEffect: what happens later (per-season tick)
//   - detectionChance: probability of being caught (for theft/skip)
//   - horseInjuryChance: probability of horse injury next season
//   - handDepartureChance: probability of hand leaving next season
//   - reputationEffect: corner adjustments
export const MORAL_CONSEQUENCES = Object.freeze({
  farrier: {
    label: 'Skip the farrier',
    savedAmount: 0,           // computed from horse count
    horseInjuryChance: 0.25,  // 25% chance of foot rot per horse
    injuryType: 'foot_rot',
    reputationEffect: { country: -2, crew: -1 },
    logLine: 'Skipped the farrier this season.',
    delayedLog: 'The farrier\'s bill is past due. The horses are paying for it.',
  },
  wages: {
    label: 'Delay hand wages',
    savedAmount: 0,           // computed from hand count
    handDepartureChance: 0.4,
    moraleHit: 20,
    reputationEffect: { crew: -8, bank: 1 },
    logLine: 'Delayed the hands\' wages.',
    delayedLog: 'A hand walked off the place. The bunkhouse is short.',
  },
  property_tax: {
    label: 'Skip the property tax',
    savedAmount: 0,           // computed
    bankCornerLoss: 12,       // severe bank hit
    foreclosureChance: 0.15,
    reputationEffect: { bank: -15, country: -3, crew: -2 },
    logLine: 'Skipped the property tax. The county is watching.',
    delayedLog: 'The county sent the foreclosure notice.',
  },
  veterinary: {
    label: 'Skip the vet for a sick horse',
    savedAmount: 0,           // computed
    horseDeathChance: 0.35,   // high risk for the sick horse
    reputationEffect: { crew: -3, horsemen: -1 },
    logLine: 'Did not call the vet for the sick one.',
    delayedLog: 'The horse did not make it through the night.',
  },
});

// Tracks skipped obligations. Each entry: { category, season, day, horseId? }
export function createMoralState() {
  return {
    skips: [],                 // history of skips
    pendingConsequences: [],   // consequences queued for next season
    choices: 0,                // total moral choices presented
    consequencesFired: 0,       // consequences that fired
  };
}

// Decide whether to skip a category. Returns { skipped, savings }.
// Pure: caller is responsible for applying savings and recording the skip.
export function skipObligation(game, category, horseId = null) {
  const def = MORAL_CONSEQUENCES[category];
  if (!def) throw new Error(`Unknown moral category: ${category}`);

  // Compute savings based on category
  let savings = 0;
  if (category === 'farrier') {
    const horseCount = game.horses?.length ?? 0;
    savings = horseCount * 90;  // matches BASE_MONTHLY.farrier_per_horse
  } else if (category === 'wages') {
    const handCount = (game.hands ?? []).filter((h) => !h.perCall && h.status !== 'gone').length;
    savings = handCount * 500;  // partial-quarter wages
  } else if (category === 'property_tax') {
    savings = 1200;  // quarterly installment
  } else if (category === 'veterinary') {
    savings = 2600;  // VET_COST
  }

  return {
    skipped: true,
    savings,
    consequence: def,
    horseId,
  };
}

// Record a moral skip. Returns updated moralState.
export function recordSkip(moralState, skip) {
  return {
    ...moralState,
    skips: [
      ...moralState.skips,
      {
        category: skip.consequence.label,
        categoryKey: skip.category ?? null,
        savings: skip.savings,
        day: skip.day,
        season: skip.season,
        horseId: skip.horseId,
        fired: false,
      },
    ],
    choices: moralState.choices + 1,
  };
}

// Apply consequences of skipped obligations at season tick.
// Each unfired skip rolls for its consequence. Returns:
//   { moralState, horseEffects, handEffects, logLines, cornerAdjustments }
export function tickMoralConsequences(moralState, game, randomFn = Math.random) {
  const newSkips = [];
  const horseEffects = [];
  const handEffects = [];
  const logLines = [];
  const cornerAdjustments = {};

  for (const skip of moralState.skips) {
    if (skip.fired) {
      newSkips.push(skip);
      continue;
    }
    // Find the consequence for this category
    const categoryKey = Object.keys(MORAL_CONSEQUENCES).find(
      (k) => MORAL_CONSEQUENCES[k].label === skip.category,
    );
    if (!categoryKey) {
      newSkips.push(skip);
      continue;
    }
    const def = MORAL_CONSEQUENCES[categoryKey];
    let fired = false;

    // Horse injury (farrier)
    if (def.horseInjuryChance && randomFn() < def.horseInjuryChance) {
      // Pick a random horse, prefer foals (they're more vulnerable)
      const horses = (game.horses ?? []).filter((h) => !h.legendary);
      if (horses.length > 0) {
        const foals = horses.filter((h) => (h.age ?? 0) < 2);
        const target = foals.length > 0 && randomFn() < 0.5
          ? foals[Math.floor(randomFn() * foals.length)]
          : horses[Math.floor(randomFn() * horses.length)];
        horseEffects.push({
          horseId: target.id,
          type: def.injuryType ?? 'lameness',
          healthDelta: -15,
          stressDelta: 10,
        });
        logLines.push(`${target.name} came up lame. The farrier's bill is past due.`);
        fired = true;
      }
    }

    // Horse death (vet)
    if (def.horseDeathChance && randomFn() < def.horseDeathChance && skip.horseId) {
      const horse = (game.horses ?? []).find((h) => h.id === skip.horseId);
      if (horse) {
        horseEffects.push({
          horseId: horse.id,
          type: 'death',
          remove: true,
        });
        logLines.push(`${horse.name} did not make it through the night. The vet should have been called.`);
        fired = true;
      }
    }

    // Hand departure (wages)
    if (def.handDepartureChance && randomFn() < def.handDepartureChance) {
      const workingHands = (game.hands ?? []).filter((h) => h.status === 'working' && !h.perCall);
      if (workingHands.length > 0) {
        const target = workingHands[Math.floor(randomFn() * workingHands.length)];
        handEffects.push({
          handId: target.id,
          type: 'departure',
          reason: 'wages',
        });
        logLines.push(`${target.name} walked off the place. The bunkhouse is short.`);
        fired = true;
      }
    }

    // Bank corner loss (tax)
    if (def.bankCornerLoss) {
      cornerAdjustments.bank = (cornerAdjustments.bank ?? 0) - def.bankCornerLoss;
      logLines.push(`The bank is watching. Credit is short.`);
      fired = true;
    }

    // Foreclosure (tax, severe)
    if (def.foreclosureChance && randomFn() < def.foreclosureChance) {
      // Mark the foreclosure flag — the season-end check picks it up
      game.foreclosurePending = true;
      logLines.push(`The county sent the foreclosure notice.`);
      fired = true;
    }

    // Corner adjustments from the skip itself
    for (const [corner, delta] of Object.entries(def.reputationEffect ?? {})) {
      cornerAdjustments[corner] = (cornerAdjustments[corner] ?? 0) + delta;
    }

    newSkips.push({ ...skip, fired });
    if (fired) {
      moralState.consequencesFired += 1;
    }
  }

  return {
    moralState: {
      ...moralState,
      skips: newSkips,
    },
    horseEffects,
    handEffects,
    logLines,
    cornerAdjustments,
  };
}

// Compute the cost of NOT skipping an obligation (i.e. what the player
// would save if they skipped). Used to make the trade-off visible.
export function skippedSavings(category, game) {
  if (category === 'farrier') {
    return (game.horses?.length ?? 0) * 90;
  }
  if (category === 'wages') {
    const handCount = (game.hands ?? []).filter((h) => !h.perCall && h.status !== 'gone').length;
    return handCount * 500;
  }
  if (category === 'property_tax') {
    return 1200;
  }
  if (category === 'veterinary') {
    return 2600;
  }
  return 0;
}

// Get the warning line for a category when it's about to be skipped.
export function skipWarning(category) {
  const warnings = {
    farrier: 'Skipping the farrier saves money now. The horses will pay later.',
    wages: 'Delaying wages saves cash. The hands notice.',
    property_tax: 'Skipping the property tax is a gamble with the bank.',
    veterinary: 'Not calling the vet is a choice. The horse pays the price.',
  };
  return warnings[category] ?? null;
}