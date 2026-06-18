// Blood & Bridle — the player's body (Phase 7).
//
// Aging. Injury. Chronic. The body gates the heir mechanic. The
// player's stamina drops. The back goes. The chronic sets in. The
// player's body fails before the ranch does.
//
// McMurtry: Gus McCrae was shot and gutted. He kept riding. Call
// watched him die slowly over the years. The body is the antagonist.
//
// Pure module. No DOM. No localStorage.

export const PLAYER_STARTING_AGE = 28;
export const PLAYER_STARTING_HEALTH = 100;

// Aging curve: stamina drops, injury risk rises, chronic accumulates.
export function agePlayer(player, yearsAdded) {
  if (yearsAdded <= 0) return player;
  const newAge = (player.age ?? PLAYER_STARTING_AGE) + yearsAdded;
  // Stamina: 100 at 25, drops to 60 by 60
  const stamina = Math.max(40, Math.min(100, 100 - (newAge - 25) * 0.8));
  // Health: 100 at 25, drops 1/year after 35
  const healthDelta = newAge > 35 ? -1 * Math.min(yearsAdded, newAge - 35) : 0;
  const newHealth = Math.max(40, (player.health ?? 100) + healthDelta);
  // Chronic conditions: 20% chance per year after 40
  let chronic = [...(player.chronic ?? [])];
  if (newAge > 40 && Math.random() < 0.2 * yearsAdded) {
    const conditions = ['bad_back', 'knee', 'shoulder', 'hearing', 'eyesight'];
    const newCondition = conditions[Math.floor(Math.random() * conditions.length)];
    if (!chronic.includes(newCondition)) {
      chronic = [...chronic, newCondition];
    }
  }
  return {
    ...player,
    age: newAge,
    stamina,
    health: newHealth,
    chronic,
  };
}

// Injury: the player can be injured by hazards (crisis moments).
// Returns the updated player.
export function injurePlayer(player, type, severity = 'moderate') {
  const injuryDays = severity === 'severe' ? 60 : severity === 'moderate' ? 30 : 14;
  return {
    ...player,
    injured: true,
    injury: {
      type,
      daysLeft: injuryDays,
      severity,
    },
    stamina: Math.max(20, (player.stamina ?? 100) - (severity === 'severe' ? 30 : 15)),
  };
}

// Tick player injury.
export function tickPlayerInjury(player) {
  if (!player.injured || !player.injury) return player;
  const newDaysLeft = player.injury.daysLeft - 1;
  if (newDaysLeft <= 0) {
    return { ...player, injured: false, injury: null };
  }
  return { ...player, injury: { ...player.injury, daysLeft: newDaysLeft } };
}

// Chronic conditions affect actions.
export function chronicEffect(player, action) {
  if (!player.chronic || player.chronic.length === 0) return null;
  const effects = [];
  if (player.chronic.includes('bad_back') && action === 'lift') {
    effects.push({ action, penalty: 'chronic_back', message: 'The back complains. You move slower.' });
  }
  if (player.chronic.includes('knee') && action === 'run') {
    effects.push({ action, penalty: 'chronic_knee', message: 'The knee locks. You stop and stretch.' });
  }
  return effects;
}

// Can the player still run the ranch? Returns true if the player
// is healthy enough to continue. Triggers the heir mechanic.
export function canPlayerContinue(player) {
  if ((player.health ?? 100) <= 20) return false;
  if ((player.stamina ?? 100) <= 30) return false;
  if (player.injured && player.injury?.severity === 'severe') return false;
  return true;
}

// McCarthy-style description of the player's body.
export function describePlayerBody(player) {
  const parts = [];
  if (player.age >= 50) parts.push('The years are on the face.');
  else if (player.age >= 40) parts.push('The years are starting.');
  if ((player.health ?? 100) < 50) parts.push('The body is failing.');
  if ((player.stamina ?? 100) < 60) parts.push('The stamina is shorter than it was.');
  if (player.chronic?.includes('bad_back')) parts.push('The back goes out in the morning.');
  if (player.chronic?.includes('knee')) parts.push('The knee is the weather report.');
  if (player.chronic?.includes('hearing')) parts.push('You cup your ear to hear.');
  if (player.chronic?.includes('eyesight')) parts.push('You squint at the bills.');
  if (player.injured) parts.push(`The ${player.injury?.type ?? 'injury'} is still healing.`);
  if (parts.length === 0) {
    return 'You are sound. The body answers when called.';
  }
  return parts.join(' ');
}

// Initialize a player object.
export function createPlayer() {
  return {
    age: PLAYER_STARTING_AGE,
    health: PLAYER_STARTING_HEALTH,
    stamina: 100,
    chronic: [],
    injured: false,
    injury: null,
  };
}