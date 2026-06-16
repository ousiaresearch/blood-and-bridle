// Test helpers. Build a game state from a partial override.

import { createNewGame } from '../src/game.js';

export function makeGame(overrides = {}) {
  let g = createNewGame();
  for (const [k, v] of Object.entries(overrides)) {
    if (k === 'horses' && Array.isArray(v)) {
      g = { ...g, horses: v };
    } else if (k === 'parcels' && Array.isArray(v)) {
      g = { ...g, parcels: v };
    } else {
      g = { ...g, [k]: v };
    }
  }
  return g;
}
