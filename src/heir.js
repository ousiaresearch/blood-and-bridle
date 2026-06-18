// Blood & Bridle — dynastic continuation.
//
// The heir. When the player can't continue — body fails, the moment
// arrives — the most senior hand takes over. The ranch continues,
// but the Country corner takes a hit (the community has to relearn
// trust). Day-workers do not transfer (they are the community's
// memory of the place, and they go elsewhere).
//
// McMurtry: the land outlives the people. The brand is what stays.
// The Hat Creek outfit continued after Gus and Call because there
// were hands to keep it going.
//
// Pure module. No DOM. No localStorage.

// Heir selection: by seniority. Mae is first (longest-tenured hand),
// then Eli, then Reyes, then Elena, then Voss (the vet — last resort).
const HEIR_PRIORITY = ['mae', 'eli', 'reyes', 'elena', 'cordell-voss'];

// Build an heir from the most senior working hand. Returns:
//   { heir, transitionDamage, narrative }
// where narrative is a McCarthy-style fragment about the transition.
export function buildHeir(game) {
  const hands = game.hands ?? [];
  // Find the first working hand in priority order
  let heir = null;
  for (const id of HEIR_PRIORITY) {
    const hand = hands.find((h) => h.id === id && h.status === 'working');
    if (hand) {
      heir = hand;
      break;
    }
  }
  if (!heir) {
    // No working hands — the ranch is done.
    return {
      heir: null,
      transitionDamage: { country: -20, crew: -10, bank: -5 },
      narrative: 'No hands to take over. The brand is off the gate. The land remembers.',
    };
  }

  // Transition damage: Country takes the biggest hit (the community
  // has to trust the new person). Crew -5 (some hands may not stay
  // for the new boss). Bank -3 (the bank may call for a year to
  // re-evaluate). Horsemen gains +3 (new blood at the show circuit).
  const transitionDamage = {
    country: -15,
    crew: -5,
    bank: -3,
    horsemen: 3,
  };

  const narratives = {
    mae: `${heir.name} took over the place. She runs the colts the way she always did. The neighbors came to the funeral.`,
    eli: `${heir.name} took over the place. He knows every fence line. He knows every debt rumor.`,
    reyes: `${heir.name} took over the place. The stallions listen to him the way they listened to you.`,
    elena: `${heir.name} took over the place. The books are tighter. The hands tolerate it.`,
    'cordell-voss': `${heir.name} stepped in. He was the vet. Now he is the owner. The horses do not know the difference.`,
  };

  return {
    heir,
    transitionDamage,
    narrative: narratives[heir.id] ?? `${heir.name} took over the place.`,
  };
}

// Apply the heir transition to the game state. Returns new game with:
//   - The heir is now the player
//   - Country corner takes a hit
//   - Day-workers are not transferred
//   - The brand stays the same (the brand is what survives)
//   - The heir's morale is reset (it's their place now)
export function applyHeirTransition(game) {
  const result = buildHeir(game);
  if (!result.heir) {
    return {
      ...game,
      dayWorkers: [], // day-workers don't transfer
      reputationCorners: {
        horsemen: Math.max(0, (game.reputationCorners?.horsemen ?? 0) + result.transitionDamage.horsemen),
        country: Math.max(0, (game.reputationCorners?.country ?? 0) + result.transitionDamage.country),
        bank: Math.max(0, (game.reputationCorners?.bank ?? 0) + result.transitionDamage.bank),
        crew: Math.max(0, (game.reputationCorners?.crew ?? 0) + result.transitionDamage.crew),
      },
      log: [result.narrative, ...(game.log ?? [])].slice(0, 20),
      heirTransitionPending: false,
    };
  }

  // Heir inherits. Their morale is reset (it's their place now).
  const newHands = (game.hands ?? []).map((h) => h.id === result.heir.id
    ? { ...h, morale: Math.max(70, h.morale), hoursThisWeek: 0, status: 'working' }
    : h);

  return {
    ...game,
    hands: newHands,
    dayWorkers: [], // day-workers don't transfer
    reputationCorners: {
      horsemen: Math.max(0, (game.reputationCorners?.horsemen ?? 0) + result.transitionDamage.horsemen),
      country: Math.max(0, (game.reputationCorners?.country ?? 0) + result.transitionDamage.country),
      bank: Math.max(0, (game.reputationCorners?.bank ?? 0) + result.transitionDamage.bank),
      crew: Math.max(0, (game.reputationCorners?.crew ?? 0) + result.transitionDamage.crew),
    },
    ownerName: result.heir.name,
    log: [result.narrative, ...(game.log ?? [])].slice(0, 20),
    heirTransitionPending: false,
    generationCount: (game.generationCount ?? 1) + 1,
  };
}

// Generate a generational narrative for the dynasty system.
// Returns a string describing the transition across generations.
export function generationalNarrative(game) {
  const generation = game.generationCount ?? 1;
  if (generation <= 1) {
    return 'The first generation. The brand is yours. The land remembers what you did with it.';
  }
  return `The ${ordinal(generation)} generation. The brand is the same. The hands are different. The land remembers.`;
}

// Convert a number to its ordinal form (1st, 2nd, 3rd, 4th, ...)
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}