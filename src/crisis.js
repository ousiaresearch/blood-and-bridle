// Blood & Bridle — crisis moments.
//
// The moments when the player has to make a terrible choice. Not
// obviously wrong. Just hard. The barn burns. The flood is coming.
// The horse broke its leg. The foal crop was killed by the late
// frost. The market crashed. A hand is killed on the job.
//
// The crisis system fires catastrophic events and gives the player
// 2-3 options. Each option has consequences. None are obviously
// right.
//
// Pure module. No DOM. No localStorage.

export const CRISIS_TYPES = Object.freeze({
  FIRE: 'fire',
  FLOOD: 'flood',
  OUTBREAK: 'outbreak',
  BROKEN_LEG: 'broken_leg',
  HAND_DEATH: 'hand_death',
  DROUGHT_RUNS_OUT_HAY: 'drought_runs_out_hay',
  MARKET_CRASH: 'market_crash',
  LATE_FROST: 'late_frost',
});

// Each crisis has 2-3 options with consequences.
export const CRISIS_DEFS = Object.freeze({
  [CRISIS_TYPES.FIRE]: {
    title: 'The barn is on fire',
    description: 'Lightning hit the hay barn. The flames are climbing. The horses are inside.',
    options: [
      {
        label: 'Save the horses',
        cost: 0,
        consequence: 'horses safe, barn lost',
        effects: { cash: -2500, legacy: -3, horses: 'safe', horsemen: 5, crew: 3 },
        log: 'Saved every horse. Lost the barn and the hay inside.',
      },
      {
        label: 'Save the hay (let the horses out)',
        cost: 0,
        consequence: 'hay saved, horses escaped',
        effects: { cash: 1500, legacy: -8, horses: 'escaped', horsemen: -5, crew: -8 },
        log: 'Saved the hay. The horses broke out. Two went over the fence.',
      },
      {
        label: 'Call the fire department and pray',
        cost: 0,
        consequence: 'random outcome',
        effects: {},
        log: 'The fire trucks came. Half the barn was lost.',
      },
    ],
  },
  [CRISIS_TYPES.FLOOD]: {
    title: 'The creek is rising',
    description: 'Three days of rain. The creek is over its banks. The mares are on the low ground.',
    options: [
      {
        label: 'Move the mares at any cost',
        cost: 0,
        consequence: 'horses moved, cash lost',
        effects: { cash: -800, horses: 'moved', legacy: 4, horsemen: 2, crew: 4 },
        log: 'Mae and Eli worked through the night. The mares are on high ground.',
      },
      {
        label: 'Let them swim for it',
        cost: 0,
        consequence: 'horses at risk',
        effects: { horses: 'at_risk', legacy: -6, crew: -5 },
        log: 'The mares made it across on their own. Lost a yearling to the current.',
      },
      {
        label: 'Open the south gate to the neighbors\' pasture',
        cost: 0,
        consequence: 'horses safe, country +',
        effects: { horses: 'safe', legacy: 3, country: 8, crew: 2 },
        log: 'The neighbors opened the gate. The mares are on dry ground. The country remembers.',
      },
    ],
  },
  [CRISIS_TYPES.OUTBREAK]: {
    title: 'Strangles is in the barn',
    description: 'Three horses are running fevers. The vet says it is strangles. The county fair is in two weeks.',
    options: [
      {
        label: 'Quarantine the barn for 30 days',
        cost: 0,
        consequence: 'no shows for 30 days, herd treated',
        effects: { cash: -3500, legacy: 4, horsemen: -3, crew: 5 },
        log: 'Quarantined the barn. No shows for a month. The herd pulled through.',
      },
      {
        label: 'Sell the sick horses now, quietly',
        cost: 0,
        consequence: 'cash in, reputation hit',
        effects: { cash: 4500, legacy: -10, horsemen: -8, country: -5 },
        log: 'Sold the three sick ones to a buyer in Wyoming. The country heard.',
      },
      {
        label: 'Shoot the worst and treat the rest',
        cost: 0,
        consequence: 'one lost, two treated',
        effects: { cash: -2200, legacy: -2, horsemen: -2, crew: 0 },
        log: 'Lost the worst one. The other two came back. The bunkhouse is quiet.',
      },
    ],
  },
  [CRISIS_TYPES.BROKEN_LEG]: {
    title: 'A horse broke its leg',
    description: 'The colt came up lame after the morning turn-out. The vet is on the way. The leg is broken clean.',
    options: [
      {
        label: 'Put it down',
        cost: 0,
        consequence: 'horse gone, clean end',
        effects: { horses: 'downed', cash: -200, legacy: 0, crew: -3 },
        log: 'Put the colt down in the pasture. Mae did not come to supper.',
      },
      {
        label: 'Pay the surgery',
        cost: 0,
        consequence: 'horse saved, cash gone',
        effects: { cash: -12000, legacy: 2, horsemen: 4, crew: 5 },
        log: 'The surgery took six hours. The colt will not be sound, but it will live.',
      },
      {
        label: 'Send it to the university',
        cost: 0,
        consequence: 'unknown',
        effects: {},
        log: 'Sent the colt to the university. They will study the break.',
      },
    ],
  },
  [CRISIS_TYPES.HAND_DEATH]: {
    title: 'A hand was killed on the job',
    description: 'The horse rolled on him. He did not get up. The bunkhouse is one short.',
    options: [
      {
        label: 'Hold the funeral at the place',
        cost: 0,
        consequence: 'crew -5, legacy +3, country +2',
        effects: { cash: -800, legacy: 3, country: 2, crew: -5 },
        log: 'Held the funeral under the cottonwood. The neighbors came. The hands did not speak for a week.',
      },
      {
        label: 'Quiet burial, no service',
        cost: 0,
        consequence: 'crew -8',
        effects: { cash: -400, legacy: -2, crew: -8 },
        log: 'Buried him quiet. The hands noticed.',
      },
      {
        label: 'Drive the body to the family',
        cost: 0,
        consequence: 'country +5, legacy +2',
        effects: { cash: -1200, legacy: 2, country: 5, crew: -2 },
        log: 'Drove the body home. The family will remember.',
      },
    ],
  },
  [CRISIS_TYPES.DROUGHT_RUNS_OUT_HAY]: {
    title: 'The hay has run out',
    description: 'The drought has reached the feed store. Hay is three times the price. The mares are eating the leavings.',
    options: [
      {
        label: 'Buy hay at any price',
        cost: 0,
        consequence: 'cash gone, horses fed',
        effects: { cash: -8500, legacy: 0, country: 3, crew: 4 },
        log: 'Bought hay at three times the price. The mares are eating.',
      },
      {
        label: 'Sell the herd down to what you can feed',
        cost: 0,
        consequence: 'horses sold, cash in',
        effects: { cash: 6500, legacy: -10, horsemen: -3, country: -3 },
        log: 'Sold three horses at the auction. Kept the oldest and the favorite.',
      },
      {
        label: 'Move the herd to the leased grounds',
        cost: 0,
        consequence: 'rent paid, herd safe',
        effects: { cash: -2400, horsemen: 2, country: 5 },
        log: 'Moved the herd to the leased grounds. The grass is still there.',
      },
    ],
  },
  [CRISIS_TYPES.MARKET_CRASH]: {
    title: 'The market has crashed',
    description: 'The big buyers have stopped buying. Prices are at half what they were. The fall sale is in two weeks.',
    options: [
      {
        label: 'Hold and wait for the market to recover',
        cost: 0,
        consequence: 'no sale, hold the herd',
        effects: { horsemen: 2, country: 2, bank: -3 },
        log: 'Held the herd. The market will come back. It has to.',
      },
      {
        label: 'Sell at the bottom',
        cost: 0,
        consequence: 'cash in, herd reduced',
        effects: { cash: 4500, legacy: -8, horsemen: -6, crew: -2 },
        log: 'Sold at the bottom. The herd is smaller. The books are cleaner.',
      },
      {
        label: 'Send the colts to the big ranch in Texas',
        cost: 0,
        consequence: 'colts placed, future income',
        effects: { legacy: -2, horsemen: 4 },
        log: 'Sent the colts to Texas. They will be back next spring, or they will not.',
      },
    ],
  },
  [CRISIS_TYPES.LATE_FROST]: {
    title: 'A late frost took the foal crop',
    description: 'A hard frost in late spring. The mares that foaled this week lost them. The spring is dead.',
    options: [
      {
        label: 'Rebreed the mares immediately',
        cost: 0,
        consequence: 'next year foal crop',
        effects: { cash: -1200, legacy: -3, horsemen: 2, country: 2 },
        log: 'Rebred the mares. Next year will be better.',
      },
      {
        label: 'Buy foals from the neighbor',
        cost: 0,
        consequence: 'cash spent, herd restored',
        effects: { cash: -6000, legacy: 1, country: 4 },
        log: 'Bought three foals from the neighbor. The bloodlines are not the same.',
      },
      {
        label: 'Take the year off',
        cost: 0,
        consequence: 'no foals, no spend',
        effects: { legacy: -5, horsemen: -3 },
        log: 'Took the year off from breeding. The place is quieter.',
      },
    ],
  },
});

// Build a crisis object for the game state. Returns the crisis event
// that should be presented to the player.
export function createCrisis(type, day) {
  const def = CRISIS_DEFS[type];
  if (!def) throw new Error(`Unknown crisis type: ${type}`);
  return {
    id: `crisis-${type}-${day}`,
    type,
    title: def.title,
    description: def.description,
    options: def.options,
    day,
    resolved: false,
    chosenOptionIndex: null,
  };
}

// Resolve a crisis. Returns the chosen option's effects applied to
// a working copy of the game state, plus the crisis with the
// resolution recorded.
export function resolveCrisis(crisis, optionIndex, game) {
  const option = crisis.options[optionIndex];
  if (!option) throw new Error(`Invalid crisis option: ${optionIndex}`);

  let next = { ...game };
  const effects = option.effects ?? {};

  // Cash effects
  if (typeof effects.cash === 'number') {
    next = { ...next, cash: next.cash + effects.cash };
  }

  // Legacy effects
  if (typeof effects.legacy === 'number') {
    next = { ...next, legacy: Math.max(0, Math.min(100, next.legacy + effects.legacy)) };
  }

  // Corner effects
  const cornerKeys = ['horsemen', 'country', 'bank', 'crew'];
  const cornerDeltas = {};
  for (const c of cornerKeys) {
    if (typeof effects[c] === 'number') {
      cornerDeltas[c] = effects[c];
    }
  }

  // Horse effects
  if (effects.horses === 'downed') {
    // Pick a horse and put it down
    next = { ...next, horses: next.horses.slice(1) };
  }

  // Record the resolution
  return {
    game: next,
    crisis: {
      ...crisis,
      resolved: true,
      chosenOptionIndex: optionIndex,
    },
    cornerDeltas,
    log: option.log,
  };
}

// Crisis triggers. Given the current game state, returns an array of
// crisis types that could fire. Pure: caller rolls dice.
export function detectCrisisTriggers(game) {
  const triggers = [];
  const cash = game.cash ?? 0;
  const horsemen = game.reputationCorners?.horsemen ?? 50;
  const crew = game.reputationCorners?.crew ?? 50;
  const bank = game.reputationCorners?.bank ?? 50;
  const feedCapacity = (game.parcels ?? []).reduce((s, p) => s + (p.feedCapacity ?? 0), 0);
  const horseCount = game.horses?.length ?? 0;

  // Feed shortage: more horses than feed capacity
  if (feedCapacity > 0 && horseCount > feedCapacity * 1.5) {
    triggers.push({ type: CRISIS_TYPES.DROUGHT_RUNS_OUT_HAY, chance: 0.15 });
  }

  // Low horsemen corner = market crash risk
  if (horsemen < 20) {
    triggers.push({ type: CRISIS_TYPES.MARKET_CRASH, chance: 0.10 });
  }

  // Low bank corner = late frost (the bank calls in spring)
  if (bank < 20) {
    triggers.push({ type: CRISIS_TYPES.LATE_FROST, chance: 0.08 });
  }

  // Low crew corner = hand death risk (working too hard, not enough hands)
  if (crew < 20 && (game.hands ?? []).filter((h) => h.status === 'working').length <= 1) {
    triggers.push({ type: CRISIS_TYPES.HAND_DEATH, chance: 0.05 });
  }

  // High horse count + low crew = broken leg (handling mistakes)
  if (horseCount > 8 && crew < 40) {
    triggers.push({ type: CRISIS_TYPES.BROKEN_LEG, chance: 0.10 });
  }

  // No insurance + drought weather = fire risk
  if (!game.insuranceEnabled) {
    triggers.push({ type: CRISIS_TYPES.FIRE, chance: 0.04 });
  }

  // Flood risk in Spring with creek parcel unimproved
  const creek = (game.parcels ?? []).find((p) => p.id === 'cedar-draw');
  if (creek && !creek.improvement && creek.state === 'flooded') {
    triggers.push({ type: CRISIS_TYPES.FLOOD, chance: 0.20 });
  }

  return triggers;
}

// Pick a crisis to fire from the detected triggers. Returns the
// chosen crisis event, or null.
export function pickCrisisToFire(triggers, day, randomFn = Math.random) {
  for (const t of triggers) {
    if (randomFn() < t.chance) {
      return createCrisis(t.type, day);
    }
  }
  return null;
}