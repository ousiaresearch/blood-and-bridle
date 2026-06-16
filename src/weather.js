// Weather and disasters. Drought, fire, flood, blizzard, disease. Seasonal.
// Each has a chance to fire on the season boundary tick.

import { getSeason } from './seasons.js';

export const DISASTERS = [
  {
    id: 'drought',
    title: 'Drought',
    seasons: ['Summer', 'Fall'],
    chance: 0.15,
    effect: (game) => ({
      ...game,
      parcels: game.parcels.map((p) => ({ ...p, forage: Math.max(0, p.forage - 28), water: Math.max(0, p.water - 22) })),
    }),
    log: 'A drought rolled in from the south. Forage and water dropped hard. Decisions just got more expensive.',
  },
  {
    id: 'barn-fire',
    title: 'Barn fire',
    seasons: ['Summer', 'Fall'],
    chance: 0.04,
    effect: (game) => ({
      ...game,
      cash: game.cash - 4500,
      legacy: Math.max(0, game.legacy - 4),
    }),
    log: 'Lightning hit the hay barn. Loss: $4,500 and a piece of family history that cannot be replaced.',
  },
  {
    id: 'flood',
    title: 'Spring flood',
    seasons: ['Spring'],
    chance: 0.12,
    effect: (game) => ({
      ...game,
      parcels: game.parcels.map((p) => ({ ...p, forage: Math.max(0, p.forage - 18), water: 100 })),
    }),
    log: 'The river took the low pasture for a week. Forage is thin, but the water table is full.',
  },
  {
    id: 'blizzard',
    title: 'Winter blizzard',
    seasons: ['Winter'],
    chance: 0.18,
    effect: (game) => ({
      ...game,
      cash: game.cash - 1200,
      horses: game.horses.map((h) => ({ ...h, stress: Math.min(100, h.stress + 12), health: Math.max(0, h.health - 6) })),
    }),
    log: 'A blizzard shut down the back roads for three days. Vet bills, feed, and stress on every horse.',
  },
  {
    id: 'disease',
    title: 'Strangles outbreak',
    seasons: ['Spring', 'Fall'],
    chance: 0.06,
    effect: (game) => ({
      ...game,
      cash: game.cash - 1800,
      horses: game.horses.map((h) => ({ ...h, health: Math.max(0, h.health - 8) })),
    }),
    log: 'A respiratory illness went through the barn. Vaccinations were not optional this year.',
  },
];

export function rollDisaster(game) {
  const season = getSeason(game);
  for (const d of DISASTERS) {
    if (!d.seasons.includes(season)) continue;
    if (Math.random() < d.chance) {
      return { disaster: d, game: { ...d.effect(game), log: [d.log, ...game.log].slice(0, 20) } };
    }
  }
  return { disaster: null, game };
}
