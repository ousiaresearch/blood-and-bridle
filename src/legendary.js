// The legendary horse.
//
// McMurtry's Hell Bitch is a dapple-gray mare with a white muzzle and
// white forehead streak. She bit a chunk out of Call above the belt.
// She is hated by everyone but Call, and later by everyone but Newt
// who inherits her. She is fast, dangerous, and a serious piece of
// work to ride.
//
// The legendary horse in Blood & Bridle is one per save. A mare, not a
// gelding (the McMurtry detail). Dapple-gray with white markings.
// Extreme stats: heart and bone density capped near 100, but a
// temperament so difficult that the horse cannot be ridden until
// legendaryUnlockedDay (default day 90). After that, training rises
// at 1.5x, bond cap is 100, and value is 2.5x base. The horse cannot
// be sold or auctioned until she's been bonded with — there's a
// loyalty gate.
//
// The horse is generated at createNewGame time, not bred. She is the
// picturebook horse — the one the player must earn.

import { createHorse, getLifeStage } from './horse.js';

// Default unlock day. 90 in-game days = 3 seasons = quarter-year
// under the calendar.
export const DEFAULT_UNLOCK_DAY = 90;

// Legendary horse archetypes. Each is a McMurtry-grade profile. The
// game picks one at save creation.
export const LEGENDARY_ARCHETYPES = [
  {
    archetypeId: 'hell-bitch',
    name: 'Gray Lady',
    breed: 'quarter_horse',
    coat: 'dapple-gray with a white muzzle and a white forehead streak, possibly Kiowa-bred',
    temperament: 'Dominant, dangerous, hates strangers. Bites the hand that does not come slow. Worth more than the barn.',
    role: 'Reining mare',
    age: 4,
    training: 8,
    bond: 6,
    health: 92,
    stress: 12,
    value: 48000,
    traits: { gait_quality: 94, temperament_stability: 28, bone_density: 90, heart: 96, conformation: 88 },
    backstory: 'They brought her off the high country in a stock trailer. She kicked the sidewall in twice. Three handlers tried to load her. None of them rode her.',
  },
  {
    archetypeId: 'iron-pine',
    name: 'Iron Pine',
    breed: 'thoroughbred',
    coat: 'dark bay, no white markings, the kind of horse that does not photograph well but moves like weather',
    temperament: 'Hot, brilliant, not yet convinced humans matter. Will run through a fence before she will run beside one.',
    role: 'Racehorse',
    age: 3,
    training: 12,
    bond: 4,
    health: 88,
    stress: 24,
    value: 62000,
    traits: { gait_quality: 96, temperament_stability: 22, bone_density: 78, heart: 92, conformation: 90 },
    backstory: 'Sold out of a sale barn for the price of a used truck. The trainer quit. The buyer did not.',
  },
  {
    archetypeId: 'asher',
    name: 'Asher',
    breed: 'andalusian',
    coat: 'grey, dappled, the kind of grey that turns white at fifteen but stays dappled till the day he dies',
    temperament: 'A thinker. Needs a job or invents one. Decides who rides him. Sometimes lets you.',
    role: 'Working cowhorse',
    age: 5,
    training: 14,
    bond: 8,
    health: 95,
    stress: 8,
    value: 56000,
    traits: { gait_quality: 86, temperament_stability: 38, bone_density: 92, heart: 84, conformation: 94 },
    backstory: 'Came off the King Ranch. Took two years to load. Took one to teach. None to forget.',
  },
];

// Generate a legendary horse for the player's save. Pure function
// given the RNG. Returns a horse ready to add to game.horses.
//
// The horse is not yet rideable. The breeding and competition UIs
// must check `isLegendaryRidden(game, horse)` to gate availability.
//
// The horse cannot be sold before bonded — there is a loyalty gate
// enforced by `canSellHorse(game, horse)`.
export function generateLegendaryHorse(rng = Math.random, day = 1) {
  const archetype = LEGENDARY_ARCHETYPES[Math.floor(rng() * LEGENDARY_ARCHETYPES.length)];
  const id = `legendary-${archetype.archetypeId}-${Math.floor(rng() * 1e6).toString(36)}`;

  return {
    ...createHorse({
      id,
      name: archetype.name,
      sex: 'female',
      age: archetype.age,
      role: archetype.role,
      bloodline: `${archetype.archetypeId} line, unknown sire`,
      temperament: archetype.temperament,
      training: archetype.training,
      bond: archetype.bond,
      health: archetype.health,
      stress: archetype.stress,
      value: archetype.value,
      breed: archetype.breed,
    }),
    traits: { ...archetype.traits },
    legendary: {
      archetypeId: archetype.archetypeId,
      coat: archetype.coat,
      backstory: archetype.backstory,
      unlockedDay: day + DEFAULT_UNLOCK_DAY,
      bonded: false,
    },
  };
}

// Is this legendary horse rideable at this game state?
export function isLegendaryRidden(game, horse) {
  if (!horse?.legendary) return true;
  if (game.day >= horse.legendary.unlockedDay) return true;
  return false;
}

// Can this legendary horse be sold at this game state?
export function canSellLegendary(game, horse) {
  // Non-legendary horses are always sellable (other gates apply elsewhere).
  if (!horse?.legendary) return { ok: true };
  // Must be bonded first.
  if (!horse.legendary.bonded) return { ok: false, reason: 'The legendary horse will not leave until she trusts you.' };
  // Must be rideable (unlock day passed).
  if (!isLegendaryRidden(game, horse)) {
    return { ok: false, reason: 'She is not ready. Wait the season.' };
  }
  return { ok: true };
}

// Mark the legendary horse as bonded. Called when training/bonding
// pushes bond >= 50. After bonding, the horse is yours.
export function maybeBondLegendary(horse) {
  if (!horse?.legendary) return horse;
  if (horse.legendary.bonded) return horse;
  if (horse.bond >= 50) {
    return { ...horse, legendary: { ...horse.legendary, bonded: true } };
  }
  return horse;
}

// Apply the legendary training bonus: 1.5x training gains, bond cap
// 100. Used by the train action.
export function applyLegendaryTrainingBonus(horse) {
  if (!horse?.legendary) return horse;
  if (!horse.legendary.bonded) return horse;
  if (horse.training >= 100) return horse;
  return { ...horse, training: Math.min(100, Math.round(horse.training + 1)) };
}

// On death or retirement, apply the legendary epithet. The McMurtry
// move — the earned code is the one that lives without saying.
export function legendaryEpitaph(horse) {
  if (!horse?.legendary) return null;
  const name = horse.name;
  switch (horse.legendary.archetypeId) {
    case 'hell-bitch':
      return `${name} never trusted anyone. She let one hand near her neck. He was the only one she ever missed.`;
    case 'iron-pine':
      return `${name} ran through a fence once. He never ran from anything else. The pasture is not quieter — it is empty.`;
    case 'asher':
      return `${name} decided who could ride him. He decided one hand was worth it. That hand will not replace him.`;
    default:
      return `${name} was a picturebook horse. He went on eating.`;
  }
}

// Returns the legendary horse from the herd, or null if there is none.
export function findLegendary(horses) {
  if (!Array.isArray(horses)) return null;
  return horses.find((h) => h?.legendary) ?? null;
}

// UI: the legendary horse detail block. Rendered into the horse
// detail modal when the horse is legendary.
export function renderLegendaryBlock(horse, game) {
  if (!horse?.legendary) return '';
  const leg = horse.legendary;
  const unlocked = isLegendaryRidden(game, horse);
  const bonded = leg.bonded;
  const unlockedDay = leg.unlockedDay;

  return `
    <section class="detail-section detail-section--legendary">
      <h3 class="eyebrow">Legendary</h3>
      <p class="legendary-coat">${escapeHtml(leg.coat)}</p>
      <p class="legendary-backstory">${escapeHtml(leg.backstory)}</p>
      <ul class="legendary-status">
        <li>${bonded ? 'Bonded.' : 'Not yet bonded. She will not leave until she trusts you.'}</li>
        <li>${unlocked ? `Ridden since day ${unlockedDay}.` : `Unlocks day ${unlockedDay}. She will not be ridden before then.`}</li>
      </ul>
    </section>
  `;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}