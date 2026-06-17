// Portrait integration for Blood & Bridle
// Loads generated portraits, matches to horses, provides fallback chain.

const portraitCache = new Map();
let portraitsModule = null;

async function loadPortraitsModule() {
  if (portraitsModule) return portraitsModule;
  try {
    portraitsModule = await import('/assets/horses/index.js');
    return portraitsModule;
  } catch (e) {
    console.debug('Portraits module not yet generated, using fallback');
    return null;
  }
}

export async function preloadPortraits() {
  const mod = await loadPortraitsModule();
  if (!mod) return;
  for (const p of mod.PORTRAITS) {
    portraitCache.set(p.id, p.path);
  }
}

export function getPortraitForHorse(horse) {
  try {
    if (portraitsModule) {
      const url = portraitsModule.getPortraitUrl(horse);
      if (url) return { type: 'portrait', url, credit: 'FAL gpt-image-2' };
    }
  } catch (e) {}
  return { type: 'silhouette', stageId: horse.stageId };
}

export function renderPortrait(horse) {
  const result = getPortraitForHorse(horse);
  if (result.type === 'portrait') {
    return `<span class="horse-portrait" style="background-image: url('${result.url}')" aria-hidden="true"></span>`;
  }
  return `<span class="horse-silhouette" style="--silhouette: url('${silhouetteFor(horse.stageId)}')" aria-hidden="true"></span>`;
}

import { silhouetteFor } from './silhouettes.js';
export { silhouetteFor };