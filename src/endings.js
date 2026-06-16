// Endings. The game ends on bankruptcy, on year 5, or on the player choosing
// to stop. Each ending is a verdict, not a punishment.

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
      landScore * 1000,
  );
}
