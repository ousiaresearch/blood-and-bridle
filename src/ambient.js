// Ambient layer. Translates game state (season, weather, tutorial) into
// ambient preset selections. The audio engine plays the actual sound; this
// module decides *which* sound fits the moment.
//
// Defaults: ambient is OFF. The player must opt in via the toggle in the
// hero. This keeps the default experience quiet and respectful.

import { AMBIENT_PRESETS } from './audio.js';

// Map of state → preset name
function presetForState({ season, disaster, inTutorial, day }) {
  // No ambient in the first 10 days — let the tutorial breathe
  if (inTutorial && day <= 10) return 'off';
  if (disaster === 'blizzard' || disaster === 'storm') return 'wind';
  if (disaster === 'drought') return 'wind';
  if (disaster === 'flood') return 'rain';
  if (season === 'Winter') return 'winter';
  if (season === 'Summer') return 'drone';
  if (season === 'Spring') return 'drone';
  if (season === 'Fall') return 'drone';
  return 'off';
}

// Pure function for tests: given a snapshot of game state, return the preset.
export function chooseAmbientPreset(game, options = {}) {
  if (!game) return 'off';
  const day = game.day ?? 0;
  const tutorial = game.tutorial ?? {};
  const inTutorial = !tutorial.dismissed;
  const season = options.season ?? null;
  const disaster = options.disaster ?? null;
  return presetForState({ season, disaster, inTutorial, day });
}

// Driver: takes the audio engine, computes the right preset for the current
// game state, and applies it. Returns the preset that was applied.
export function applyAmbientForGame(audio, game, options = {}) {
  if (!audio || typeof audio.ambient !== 'function') return 'off';
  const preset = chooseAmbientPreset(game, options);
  audio.ambient(preset);
  return preset;
}

// Convenience for an enabled toggle UI
export function listAmbientPresets() {
  return Object.keys(AMBIENT_PRESETS);
}
