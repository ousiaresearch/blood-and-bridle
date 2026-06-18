// Endings. The game ends on bankruptcy, on year 5, on the player choosing
// to stop, or on a corner collapsing for 3+ seasons. Each ending is a
// verdict, not a punishment. McMurtry: the land outlives everyone.

import { getYear } from './seasons.js';

export const ENDINGS = [
  {
    id: 'dynasty',
    label: 'Dynasty',
    body: 'A third generation stands in the barn. The land remembers you.',
    gate: (game) => getYear(game) >= 5 && game.legacy >= 70 && game.cash >= 0,
  },
  {
    id: 'sold-out',
    label: 'Sold Out',
    body: 'The west meadow is a parking lot. The legacy is a tax receipt.',
    gate: (game) => game.crisis?.resolved === 'sold-to-developer',
  },
  {
    id: 'bankrupt',
    label: 'Bankrupt',
    body: 'The bank called the note. The horses were sold at auction.',
    gate: (game) => game.cash < -5000,
  },
  {
    id: 'worn-out',
    label: 'Worn Out',
    body: 'The ranch survives on staff alone. The family is elsewhere.',
    gate: (game) => game.legacy <= 5,
  },
  {
    id: 'fire',
    label: 'Fire',
    body: 'The barn burned in a summer lightning storm. Insurance covered half.',
    gate: (game) => (game.firedEvents ?? []).includes('barn-burned-down'),
  },
  {
    id: 'quiet-life',
    label: 'Quiet Life',
    body: 'A modest ranch. No glory. No shame. Just life.',
    gate: (game) => getYear(game) >= 5 && game.legacy >= 30 && game.legacy < 70,
  },
  // === Phase 4.2: Four-cornered endings (one per collapsed corner) ===
  {
    id: 'horsemen-collapse',
    label: 'Forgotten by the Circuit',
    body: 'The horsemen have forgotten your name. The horses are sound, but no one is coming to see them. The brand is a memory.',
    gate: (game) => (game.collapsedCornerSeasons?.horsemen ?? 0) >= 3,
  },
  {
    id: 'country-collapse',
    label: 'The Country Shut Its Gate',
    body: 'The neighbors cross the road. The brand is burned off the gate. The hands walked off the place. The land is still yours. The land is all that is yours.',
    gate: (game) => (game.collapsedCornerSeasons?.country ?? 0) >= 3,
  },
  {
    id: 'bank-collapse',
    label: 'The Bank Called the Note',
    body: 'The line is closed. The feed store is on cash terms. The auctioneer knows your name. The horses are going on the truck.',
    gate: (game) => (game.collapsedCornerSeasons?.bank ?? 0) >= 3,
  },
  {
    id: 'crew-collapse',
    label: 'The Hands Walked Off',
    body: 'The bunkhouse is empty. The coffee is cold. The radio is still broken. The horses are fed by day-workers who do not know their names. The place runs. The place is not a ranch.',
    gate: (game) => (game.collapsedCornerSeasons?.crew ?? 0) >= 3,
  },
  {
    id: 'insolvency',
    label: 'Sold at Auction',
    body: 'Three seasons in the red. The bank has had enough. The horses were loaded on a truck at dawn. Mae was not there to see it.',
    gate: (game) => (game.insolventSeasons ?? 0) >= 3,
  },
  {
    id: 'foreclosure',
    label: 'Foreclosed',
    body: 'The county took the land. The bank took the buildings. The brand is off the gate. The hands are gone. The horses are on a truck to a place you do not know.',
    gate: (game) => game.foreclosurePending === true,
  },
];

export function checkEnding(game) {
  for (const ending of ENDINGS) {
    if (ending.gate(game)) return ending;
  }
  return null;
}

export function scoreGame(game) {
  const horseValue = game.horses.reduce((sum, h) => sum + (h.value ?? 0), 0);
  const generationScore = Math.max(0, Math.min(40, game.horses.filter((h) => h.parents).length * 8));
  const landScore = game.parcels.length * 12;
  return Math.round(
    game.cash +
      horseValue +
      game.legacy * 600 +
      game.reputation * 500 -
      game.developerPressure * 300 +
      generationScore * 1000 +
      landScore * 1000
  );
}

export function checkCornerEnding(game) {
  const collapsed = game.collapsedCornerSeasons ?? {};
  if (collapsed.horsemen >= 3) return { corner: 'horsemen', ending: ENDINGS.find((e) => e.id === 'horsemen-collapse') };
  if (collapsed.country >= 3) return { corner: 'country', ending: ENDINGS.find((e) => e.id === 'country-collapse') };
  if (collapsed.bank >= 3) return { corner: 'bank', ending: ENDINGS.find((e) => e.id === 'bank-collapse') };
  if (collapsed.crew >= 3) return { corner: 'crew', ending: ENDINGS.find((e) => e.id === 'crew-collapse') };
  return null;
}