// Blood & Bridle — parcel system.
//
// The ranch is six named parcels of land, each with its own terrain, state,
// hazard, and improvement. Land is the antagonist — it doesn't care about
// the player, but the player's choices on the land determine whether the
// horses eat, the fences hold, and the hay gets cut.
//
// McMurtry's Lonesome Dove: the land outlives everyone. The brand is what
// stays. The parcels are how the brand outlives the player.
//
// All functions are pure. No DOM. No localStorage.

export const TERRAIN = Object.freeze({
  CREEK: 'creek',          // bottom: good hay, floods in spring
  RIDGE: 'ridge',          // rocky, hard winter, shelter for mares
  SCRUB: 'scrub',          // back forty: coyotes, breaks for foals
  PASTURE: 'pasture',      // home: visible from porch
  LEASED: 'leased',        // show grounds: bills come due
  OFF_LIMITS: 'off_limits',// breeding shed: stud-only
});

export const PARCEL_STATE = Object.freeze({
  DEFAULT: 'default',
  DRAINED: 'drained',        // creek improvement: no more flood
  CLEARED: 'cleared',        // ridge improvement: more feed capacity
  FENCED: 'fenced',          // scrub improvement: prevent coyote losses
  IRRIGATED: 'irrigated',    // pasture improvement: drought-resistant
  FLOODED: 'flooded',        // creek hazard outcome
  DROUGHT: 'drought',        // pasture hazard outcome
  COYOTE_INFESTATION: 'coyote_infestation', // scrub hazard
  ROCK_SLIDE: 'rock_slide',  // ridge hazard
});

// Base parcel definitions for a fresh game. The west-meadow offer is the
// developer's — it doesn't appear here. New parcels can be purchased
// through the map system.
export const PARCEL_DEFS = Object.freeze([
  {
    id: 'home-place',
    name: 'Home Place',
    x: 1, y: 1,
    acres: 320,
    terrain: TERRAIN.PASTURE,
    baseForage: 70,
    baseWater: 70,
    baseFeedCapacity: 12,    // horse-units it can sustain
    riskModifier: 0.8,       // visible from porch — hazards noticed early
    threat: '—',
  },
  {
    id: 'cedar-draw',
    name: 'Cedar Draw',
    x: 1, y: 2,
    acres: 480,
    terrain: TERRAIN.CREEK,
    baseForage: 63,
    baseWater: 88,           // creek runs through
    baseFeedCapacity: 18,
    riskModifier: 1.2,       // floods
    threat: 'Drought line creeping east',
  },
  {
    id: 'north-ridge',
    name: 'North Ridge',
    x: 0, y: 0,
    acres: 640,
    terrain: TERRAIN.RIDGE,
    baseForage: 42,
    baseWater: 38,
    baseFeedCapacity: 14,
    riskModifier: 1.4,       // rocks, hard winter
    threat: 'Winter kill on mares',
  },
  {
    id: 'back-forty',
    name: 'Back Forty',
    x: 2, y: 0,
    acres: 800,
    terrain: TERRAIN.SCRUB,
    baseForage: 35,
    baseWater: 30,
    baseFeedCapacity: 8,     // scrubby, can't carry much
    riskModifier: 1.5,       // coyotes, breaks for foals
    threat: 'Coyote sign at the south fence',
  },
  {
    id: 'show-grounds',
    name: 'Show Grounds',
    x: 2, y: 2,
    acres: 40,               // leased, not owned
    terrain: TERRAIN.LEASED,
    baseForage: 50,
    baseWater: 50,
    baseFeedCapacity: 0,     // no grazing — show prep only
    riskModifier: 0.5,       // maintained grounds, low hazard
    threat: '—',
    leased: true,
    monthlyFee: 800,         // bills come due in fall
  },
  {
    id: 'breeding-shed',
    name: 'Breeding Shed',
    x: 1, y: 0,
    acres: 5,                // off-limits
    terrain: TERRAIN.OFF_LIMITS,
    baseForage: 0,
    baseWater: 0,
    baseFeedCapacity: 0,
    riskModifier: 0,
    threat: '—',
    offLimits: true,
  },
]);

// Improvement costs (cash + labor-hours). The labor-hours are the actual
// ratchet: improvements cost more hands than money.
export const IMPROVEMENT_COSTS = Object.freeze({
  drained:    { cash: 8000,  laborHours: 200, terrain: TERRAIN.CREEK,    label: 'Drain the creek bottom' },
  cleared:    { cash: 12000, laborHours: 400, terrain: TERRAIN.RIDGE,    label: 'Clear the north ridge' },
  fenced:     { cash: 6000,  laborHours: 240, terrain: TERRAIN.SCRUB,    label: 'High-fence the back forty' },
  irrigated:  { cash: 10000, laborHours: 320, terrain: TERRAIN.PASTURE,  label: 'Irrigate the home pasture' },
});

// Terrain → default hazard. The hazard list is intentionally short —
// weather system (Group F Phase 5) drives the actual rolls.
export const TERRAIN_HAZARD = Object.freeze({
  [TERRAIN.CREEK]:     'flood',
  [TERRAIN.RIDGE]:     'rock_fall',
  [TERRAIN.SCRUB]:     'predator',
  [TERRAIN.PASTURE]:   'drought',
  [TERRAIN.LEASED]:    'none',
  [TERRAIN.OFF_LIMITS]: 'none',
});

// Hazard → state outcome. Improvements nullify specific hazards.
export const HAZARD_OUTCOME = Object.freeze({
  flood:           { state: PARCEL_STATE.FLOODED,            canceledBy: 'drained'    },
  rock_fall:       { state: PARCEL_STATE.ROCK_SLIDE,         canceledBy: 'cleared'    },
  predator:        { state: PARCEL_STATE.COYOTE_INFESTATION, canceledBy: 'fenced'     },
  drought:         { state: PARCEL_STATE.DROUGHT,            canceledBy: 'irrigated'  },
  none:            { state: null,                             canceledBy: null         },
});

// Build initial parcels array for a new game. Backward compatible with
// the existing 3-parcel format (west-meadow is offered by the developer
// and not in the initial set).
export function createInitialParcels() {
  return PARCEL_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    x: def.x,
    y: def.y,
    forage: def.baseForage,
    water: def.baseWater,
    threat: def.threat,
    // New fields (Group F deepening):
    acres: def.acres,
    terrain: def.terrain,
    state: PARCEL_STATE.DEFAULT,
    improvement: null,                // 'drained' | 'cleared' | etc.
    hazard: TERRAIN_HAZARD[def.terrain],
    feedCapacity: def.baseFeedCapacity,
    riskModifier: def.riskModifier,
    leased: def.leased ?? false,
    offLimits: def.offLimits ?? false,
    monthlyFee: def.monthlyFee ?? 0,
  }));
}

// Add a newly purchased parcel. Used by map.buyAvailableParcel.
export function addParcel(parcels, parcelDef) {
  if (parcels.find((p) => p.id === parcelDef.id)) {
    throw new Error(`${parcelDef.name} already owned.`);
  }
  return [
    ...parcels,
    {
      id: parcelDef.id,
      name: parcelDef.name,
      x: parcelDef.x,
      y: parcelDef.y,
      forage: parcelDef.baseForage,
      water: parcelDef.baseWater,
      threat: parcelDef.threat,
      acres: parcelDef.acres,
      terrain: parcelDef.terrain,
      state: PARCEL_STATE.DEFAULT,
      improvement: null,
      hazard: TERRAIN_HAZARD[parcelDef.terrain],
      feedCapacity: parcelDef.baseFeedCapacity,
      riskModifier: parcelDef.riskModifier,
      leased: parcelDef.leased ?? false,
      offLimits: parcelDef.offLimits ?? false,
      monthlyFee: parcelDef.monthlyFee ?? 0,
    },
  ];
}

// Apply an improvement to a parcel. Returns new parcels array.
// Throws if: parcel not found, wrong terrain, already improved, or
// insufficient cash.
export function applyParcelImprovement(parcels, parcelId, improvementKey, cashOnHand) {
  const def = IMPROVEMENT_COSTS[improvementKey];
  if (!def) throw new Error(`Unknown improvement: ${improvementKey}`);
  const idx = parcels.findIndex((p) => p.id === parcelId);
  if (idx < 0) throw new Error(`Parcel not found: ${parcelId}`);
  const parcel = parcels[idx];
  if (parcel.terrain !== def.terrain) {
    throw new Error(`${def.label} requires ${def.terrain} terrain, not ${parcel.terrain}.`);
  }
  if (parcel.improvement) {
    throw new Error(`${parcel.name} is already improved (${parcel.improvement}).`);
  }
  if (cashOnHand < def.cash) {
    throw new Error(`Need $${def.cash.toLocaleString()} to ${def.label.toLowerCase()}.`);
  }
  const next = [...parcels];
  next[idx] = {
    ...parcel,
    state: improvementKey,           // state mirrors improvement key
    improvement: improvementKey,
    forage: parcel.forage + 10,      // improvement recovers forage
    water: parcel.water + 5,
    riskModifier: parcel.riskModifier * 0.5, // halved risk after improvement
  };
  return next;
}

// Roll a hazard for a parcel given the current season and weather severity.
// Improvements cancel the hazard. Returns { parcelId, hazard, outcome } or
// { parcelId, hazard: null } if the parcel is safe.
export function rollParcelHazard(parcel, season, weatherSeverity = 1) {
  const hazard = parcel.hazard;
  if (hazard === 'none') return { parcelId: parcel.id, hazard: null, outcome: null };
  const hazardDef = HAZARD_OUTCOME[hazard];
  if (!hazardDef) return { parcelId: parcel.id, hazard: null, outcome: null };

  // Improvement cancels the hazard outright.
  if (parcel.improvement === hazardDef.canceledBy) {
    return { parcelId: parcel.id, hazard, outcome: null, canceled: true };
  }

  // Seasonal modifier. Creeks flood in spring; ridges rock-fall in winter;
  // scrub gets coyotes year-round; pastures drought in summer/fall.
  const seasonMod = {
    flood:     { Spring: 1.5, Summer: 0.8, Fall: 0.5, Winter: 0.3 },
    rock_fall: { Spring: 0.7, Summer: 0.5, Fall: 0.8, Winter: 1.4 },
    predator:  { Spring: 1.2, Summer: 0.8, Fall: 1.0, Winter: 0.6 },
    drought:   { Spring: 0.3, Summer: 1.5, Fall: 1.2, Winter: 0.2 },
  }[hazard] ?? { Spring: 1, Summer: 1, Fall: 1, Winter: 1 };

  const baseChance = parcel.riskModifier * (seasonMod[season] ?? 1) * weatherSeverity * 0.15;
  const roll = Math.random();
  if (roll < baseChance) {
    return { parcelId: parcel.id, hazard, outcome: hazardDef.state };
  }
  return { parcelId: parcel.id, hazard, outcome: null };
}

// Apply hazard outcomes to parcels. Takes an array of roll results.
export function applyParcelHazardOutcomes(parcels, outcomes) {
  let next = [...parcels];
  for (const o of outcomes) {
    if (!o.outcome) continue;
    const idx = next.findIndex((p) => p.id === o.parcelId);
    if (idx < 0) continue;
    next[idx] = { ...next[idx], state: o.outcome };
  }
  return next;
}

// Compute total feed capacity across all non-leased, non-off-limits parcels.
// Returns horse-units the ranch can sustain on its own hay.
export function totalFeedCapacity(parcels) {
  return parcels
    .filter((p) => !p.leased && !p.offLimits)
    .reduce((sum, p) => sum + p.feedCapacity, 0);
}

// Total acres under management. Excludes leased and off-limits.
export function totalAcres(parcels) {
  return parcels
    .filter((p) => !p.leased && !p.offLimits)
    .reduce((sum, p) => sum + p.acres, 0);
}

// Sum of monthly fees for leased parcels (e.g. show grounds).
export function totalMonthlyParcelFees(parcels) {
  return parcels
    .filter((p) => p.leased)
    .reduce((sum, p) => sum + (p.monthlyFee ?? 0), 0);
}

// Find a parcel by id.
export function findParcel(parcels, id) {
  const p = parcels.find((x) => x.id === id);
  if (!p) throw new Error(`Parcel not found: ${id}`);
  return p;
}

// Get parcels grouped by terrain. Used by the ranch view to show sections.
export function parcelsByTerrain(parcels) {
  const groups = {};
  for (const p of parcels) {
    if (!groups[p.terrain]) groups[p.terrain] = [];
    groups[p.terrain].push(p);
  }
  return groups;
}

// Describe the parcel's current condition in a McCarthy fragment.
// Returns null if the parcel is in default state with no hazard.
export function parcelConditionLine(parcel) {
  if (parcel.improvement) {
    const labels = {
      drained:   `${parcel.name} holds. The creek runs where the ditch is.`,
      cleared:   `${parcel.name} is open. The rocks came out by hand and by mule.`,
      fenced:    `${parcel.name} holds. The high fence is coyote-tight.`,
      irrigated: `${parcel.name} is green when the rest of the country is brown.`,
    };
    return labels[parcel.improvement] ?? null;
  }
  const stateLines = {
    [PARCEL_STATE.FLOODED]:            `${parcel.name} is under water. The creek took the low ground.`,
    [PARCEL_STATE.DROUGHT]:            `${parcel.name} is dust. The grass is gone to the root.`,
    [PARCEL_STATE.COYOTE_INFESTATION]: `${parcel.name} has coyote sign. The mares will not leave the foals.`,
    [PARCEL_STATE.ROCK_SLIDE]:         `${parcel.name} let loose. A mare went down under it.`,
  };
  return stateLines[parcel.state] ?? null;
}
