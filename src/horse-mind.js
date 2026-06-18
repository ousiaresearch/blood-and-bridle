// Blood & Bridle — the horse's mind.
//
// Preferences, memory, quirks. The horse is a character, not a unit.
// The horse that was treated rough won't trust. The horse that
// was loved will follow a child into a burning barn. The horse
// won't load. The horse runs at the sight of a tarp.
//
// Pure module. No DOM. No localStorage.

export const QUIRKS = Object.freeze([
  'wont_load',           // trailer trouble
  'tarp_shy',            // flapping objects
  'barn_sour',           // doesn't want to leave the barn
  'pulls_back',          // pulls back when tied
  'cold_back',           // cinch-sensitive
  'herd_bound',          // panics when separated
  'stands_to_load',      // easy loader (positive quirk)
  'good_traveler',       // hauls well
  'steady_in_storms',    // doesn't spook
]);

export const QUIRK_LABELS = Object.freeze({
  wont_load: 'Wont load',
  tarp_shy: 'Tarp-shy',
  barn_sour: 'Barn sour',
  pulls_back: 'Pulls back when tied',
  cold_back: 'Cold-backed',
  herd_bound: 'Herd-bound',
  stands_to_load: 'Stands to load',
  good_traveler: 'Good traveler',
  steady_in_storms: 'Steady in storms',
});

// Per-hand affinity: how much each horse trusts/likes each hand.
// Range: -100 to 100. Positive = likes the hand. Negative = fear.
export function createInitialAffinity(hands = ['mae', 'eli', 'reyes', 'elena', 'cordell-voss']) {
  const affinity = {};
  for (const h of hands) {
    affinity[h] = 0;  // neutral at start
  }
  return affinity;
}

// Per-horse memory: a list of significant events the horse remembers.
// Used to determine trust changes.
export function createInitialMemory() {
  return [];
}

// Generate quirks for a new horse. 1-2 quirks, biased toward positive.
export function generateQuirks(randomFn = Math.random) {
  const numQuirks = randomFn() < 0.3 ? 2 : 1;
  const positiveQuirks = ['stands_to_load', 'good_traveler', 'steady_in_storms'];
  const negativeQuirks = ['wont_load', 'tarp_shy', 'barn_sour', 'pulls_back', 'cold_back', 'herd_bound'];
  const quirks = [];

  for (let i = 0; i < numQuirks; i++) {
    const usePositive = randomFn() < 0.4;  // 40% chance of positive quirk
    const pool = usePositive ? positiveQuirks : negativeQuirks;
    const available = pool.filter((q) => !quirks.includes(q));
    if (available.length > 0) {
      quirks.push(available[Math.floor(randomFn() * available.length)]);
    }
  }
  return quirks;
}

// Apply an event to the horse's memory and adjust affinity/trust.
// Returns the updated horse.
export function applyHorseMemory(horse, event, handId) {
  const memory = [...(horse.memory ?? [])];
  const affinity = { ...(horse.affinity ?? {}) };

  // Memory entry
  memory.unshift({
    event,
    handId,
    day: horse._day ?? 0,
    severity: eventSeverity(event),
  });
  if (memory.length > 10) memory.length = 10;

  // Affinity adjustment based on event type
  let affinityDelta = 0;
  switch (event) {
    case 'trained_well':
      affinityDelta = 3;
      break;
    case 'trained_rough':
      affinityDelta = -8;
      break;
    case 'vet_care':
      affinityDelta = 2;
      break;
    case 'vet_rough':
      affinityDelta = -5;
      break;
    case 'fed_warm':
      affinityDelta = 1;
      break;
    case 'left_out_storm':
      affinityDelta = -10;
      break;
    case 'saved_from_hazard':
      affinityDelta = 12;
      break;
    case 'loaded_quietly':
      affinityDelta = 2;
      break;
    case 'loaded_forced':
      affinityDelta = -6;
      break;
  }

  if (handId && affinity[handId] !== undefined) {
    affinity[handId] = Math.max(-100, Math.min(100, (affinity[handId] ?? 0) + affinityDelta));
  }

  return {
    ...horse,
    memory,
    affinity,
  };
}

// Severity classification of an event (1-3).
function eventSeverity(event) {
  const high = ['trained_rough', 'left_out_storm', 'saved_from_hazard', 'loaded_forced'];
  const low = ['fed_warm', 'loaded_quietly'];
  if (high.includes(event)) return 3;
  if (low.includes(event)) return 1;
  return 2;
}

// Compute the horse's effective trust in a hand based on affinity.
export function horseTrustIn(horse, handId) {
  const affinity = horse.affinity?.[handId] ?? 0;
  // Convert -100 to 100 affinity into 0 to 100 trust
  return Math.round((affinity + 100) / 2);
}

// Does the horse refuse to be handled by this hand?
export function horseRefusesHand(horse, handId) {
  const trust = horseTrustIn(horse, handId);
  return trust < 20;  // Less than 20% trust = refusal
}

// The horse's mood based on memory and quirks.
// Returns: 'calm' | 'anxious' | 'spooked' | 'bonded' | 'broken'
export function horseMood(horse) {
  const memory = horse.memory ?? [];
  const recentNegative = memory.slice(0, 3).filter((m) => m.severity === 3).length;
  const recentPositive = memory.slice(0, 3).filter((m) => m.severity === 1).length;

  if (recentNegative >= 2) return 'broken';
  if (recentNegative >= 1) return 'spooked';
  if (recentPositive >= 2) return 'bonded';
  if (horse.bond >= 80) return 'bonded';
  if (horse.stress >= 70) return 'anxious';
  return 'calm';
}

// McCarthy-style description of the horse's quirks.
export function describeQuirks(horse) {
  const quirks = horse.quirks ?? [];
  if (quirks.length === 0) {
    return `${horse.name} is steady. No notes worth writing.`;
  }
  const lines = quirks.map((q) => QUIRK_LABELS[q] ?? q);
  return `${horse.name} is ${lines.join(', ')}.`;
}

// The horse's portrait hint based on its mind state.
// Used by the renderer to pick the right portrait variant.
export function portraitHint(horse) {
  const mood = horseMood(horse);
  const quirks = horse.quirks ?? [];
  if (mood === 'broken') return 'spooked';
  if (quirks.includes('tarp_shy')) return 'anxious';
  if (mood === 'bonded') return 'proud';
  if (mood === 'anxious') return 'intense';
  return 'calm';
}

// Apply aging: horses lose quirks over time (calm down) but gain
// wisdom-related traits. Returns the updated horse.
export function ageHorseMind(horse, yearsAdded) {
  if (yearsAdded <= 0) return horse;
  const quirks = horse.quirks ?? [];
  // Each year, 10% chance to lose a quirk (positive or negative)
  let newQuirks = [...quirks];
  if (Math.random() < 0.1 * yearsAdded) {
    newQuirks = newQuirks.slice(1);  // drop the first quirk
  }
  return {
    ...horse,
    quirks: newQuirks,
  };
}