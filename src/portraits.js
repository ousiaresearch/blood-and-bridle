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

import { silhouetteFor } from './silhouettes.js';
import { liveMoodFor } from './horse.js';
export { silhouetteFor };

export function getPortraitForHorse(horse) {
  try {
    if (portraitsModule) {
      // Use the dynamic (live) mood so portraits react to stress/health/training,
      // not just the horse's temperament at creation. The lookup is shallow —
      // a temporary horse object preserves the original.
      const lookupHorse = { ...horse, mood: liveMoodFor(horse) };
      const url = portraitsModule.getPortraitUrl(lookupHorse);
      if (url) return { type: 'portrait', url, credit: 'PixelLab' };
    }
  } catch (e) {}
  return { type: 'silhouette', stageId: horse.stageId };
}

export function renderPortrait(horse, { size = 'md', className = '' } = {}) {
  const result = getPortraitForHorse(horse);
  const breedAttr = horse.breed ? ` data-breed="${escapeAttr(horse.breed)}"` : '';
  if (result.type === 'portrait') {
    const mood = liveMoodFor(horse);
    // Pixel art is the current path. image-rendering: pixelated is set
    // via the .horse-portrait--pixel class so 64x64 sprites scale up
    // without smoothing. If we ever swap back to FAL painterly portraits,
    // drop the --pixel class and let background-size: cover do its job.
    return `<span class="horse-portrait horse-portrait--pixel horse-portrait--${size} ${className}" style="background-image: url('${result.url}'); background-color: var(--portrait-${mood}, transparent)" data-horse-id="${escapeAttr(horse.id)}" data-breed="${escapeAttr(horse.breed || '')}" data-mood="${escapeAttr(mood)}" aria-hidden="true"></span>`;
  }
  const mood = liveMoodFor(horse);
  return `<span class="horse-silhouette horse-silhouette--${size} ${className}" style="--silhouette: url('${silhouetteFor(horse.stageId)}')" data-horse-id="${escapeAttr(horse.id)}"${breedAttr} data-mood="${escapeAttr(mood)}" aria-hidden="true"></span>`;
}

function escapeAttr(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Idle animation ----------

let idleAnimations = null;        // resolved animation index
let idleAnimationsFailed = false; // sentinel: don't retry on every call
let idleInterval = null;          // the cycling interval
let idleFrameIndex = 0;           // shared frame index (all horses cycle together)

async function loadIdleAnimations() {
  if (idleAnimations) return idleAnimations;
  if (idleAnimationsFailed) return null;
  try {
    const mod = await import('/assets/horses/animations/index.js');
    idleAnimations = mod.IDLE_ANIMATIONS || null;
    return idleAnimations;
  } catch (e) {
    console.debug('Idle animations not yet generated, running static');
    idleAnimationsFailed = true;
    return null;
  }
}

/**
 * Start cycling through the rest-idle animation frames for every
 * horse portrait on the page. Each frame is held for FRAME_MS, so
 * 9 frames at 500ms = ~4.5s per cycle. Pauses on hover so the player
 * can inspect the horse. Respects prefers-reduced-motion.
 *
 * Call once after the initial render. Re-call after re-renders if the
 * DOM nodes are replaced (e.g. after a season boundary).
 */
export async function startIdleAnimation() {
  if (idleInterval) return;
  const animations = await loadIdleAnimations();
  if (!animations) return;

  // Respect reduced motion.
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  // Pause on hover — read the horse-id of the hovered portrait and freeze it.
  let hoveredHorseId = null;

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest?.('.horse-portrait[data-horse-id]');
    if (el) hoveredHorseId = el.dataset.horseId;
  });
  document.addEventListener('mouseout', (e) => {
    const el = e.target.closest?.('.horse-portrait[data-horse-id]');
    if (el && el.dataset.horseId === hoveredHorseId) hoveredHorseId = null;
  });

  const FRAME_MS = 500;
  idleInterval = setInterval(() => {
    idleFrameIndex = (idleFrameIndex + 1) % 9; // 9 frames per breed
    for (const el of document.querySelectorAll('.horse-portrait[data-breed]')) {
      if (hoveredHorseId && el.dataset.horseId === hoveredHorseId) continue;
      const breed = el.dataset.breed;
      const frames = animations[breed];
      if (!frames || !frames[idleFrameIndex]) continue;
      el.style.backgroundImage = `url('${frames[idleFrameIndex]}')`;
    }
  }, FRAME_MS);
}