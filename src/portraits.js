// Portrait integration for Blood & Bridle.
//
// Hybrid visual identity:
//   - Pixel-art portraits (PixelLab, /assets/horses/) are the lineup/grid
//     view — fast scan, low cognitive load.
//   - Codex portraits (openai-codex, /assets/horses-codex/) are the
//     cinematic modal portrait — what you see when you open a horse's
//     bill-of-sale / detail view (size='xl').
//   - CSS silhouette is the ultimate fallback when neither set has
//     the horse.
//
// Lookup priority for getPortraitForHorse(horse, { size }):
//   - size === 'xl' → codex → pixel-art → silhouette
//   - else          → pixel-art → silhouette
//
// Both manifests load via lazy dynamic import. If a manifest file is
// missing, the loader caches the failure (sentinel) and the next call
// returns the next tier immediately — no retries on every render.

const pixelArtCache = new Map();
let pixelArtModule = null;
let pixelArtModuleFailed = false;

const codexCache = new Map();
let codexModule = null;
let codexModuleFailed = false;

async function loadPixelArtModule() {
  if (pixelArtModule) return pixelArtModule;
  if (pixelArtModuleFailed) return null;
  try {
    pixelArtModule = await import('/assets/horses/index.js');
    return pixelArtModule;
  } catch (e) {
    console.debug('Pixel-art portraits not yet generated, using fallback');
    pixelArtModuleFailed = true;
    return null;
  }
}

async function loadCodexModule() {
  if (codexModule) return codexModule;
  if (codexModuleFailed) return null;
  try {
    codexModule = await import('/assets/horses-codex/index.js');
    return codexModule;
  } catch (e) {
    console.debug('Codex portraits not yet generated, using fallback');
    codexModuleFailed = true;
    return null;
  }
}

export async function preloadPortraits() {
  const [pixel, codex] = await Promise.all([loadPixelArtModule(), loadCodexModule()]);
  if (pixel) {
    for (const p of pixel.PORTRAITS) {
      pixelArtCache.set(p.id, p.path);
    }
  }
  if (codex) {
    for (const p of codex.CODEX_PORTRAITS) {
      codexCache.set(p.id, p.path);
    }
  }
}

// Preload just the codex — used by the modal opener so the big portrait
// is ready by the time the modal renders. Safe to call multiple times.
export async function preloadCodex() {
  const codex = await loadCodexModule();
  if (!codex) return;
  for (const p of codex.CODEX_PORTRAITS) {
    codexCache.set(p.id, p.path);
  }
}

// Diagnostic: which tiers are loaded?
export function portraitTierStatus() {
  return {
    pixelArt: pixelArtModuleFailed ? 'failed' : (pixelArtModule ? 'loaded' : 'pending'),
    codex: codexModuleFailed ? 'failed' : (codexModule ? 'loaded' : 'pending'),
    pixelArtCount: pixelArtModule?.PORTRAITS?.length ?? 0,
    codexCount: codexModule?.CODEX_PORTRAITS?.length ?? 0,
  };
}

import { silhouetteFor } from './silhouettes.js';
import { liveMoodFor } from './horse.js';
export { silhouetteFor };

/**
 * Resolve a portrait for the given horse.
 *
 *   - size === 'xl'  → Codex first (modal cinematic), then pixel-art
 *   - else           → pixel-art first (grid lineup)
 *   - always         → silhouette if nothing matches
 *
 * Returns { type, url?, stageId?, credit }.
 */
export function getPortraitForHorse(horse, opts = {}) {
  const size = opts.size || 'md';
  const preferCodex = size === 'xl';

  // Codex — primary for modal (xl). Off the grid path; pixel-art stays
  // primary in the lineup/grid where low cognitive load matters.
  if (preferCodex && codexModule && !codexModuleFailed) {
    try {
      const lookupHorse = { ...horse, mood: liveMoodFor(horse) };
      const url = codexModule.getCodexUrl(lookupHorse);
      if (url) return { type: 'codex', url, credit: 'Codex' };
    } catch (e) {}
  }

  // Pixel-art — primary for the grid; also the fallback when codex is
  // missing or has no match for this horse.
  try {
    if (pixelArtModule && !pixelArtModuleFailed) {
      const lookupHorse = { ...horse, mood: liveMoodFor(horse) };
      const url = pixelArtModule.getPortraitUrl(lookupHorse);
      if (url) return { type: 'portrait', url, credit: 'PixelLab' };
    }
  } catch (e) {}

  // Codex — fallback for the modal when pixel-art has no match.
  if (preferCodex && codexModule && !codexModuleFailed) {
    try {
      const lookupHorse = { ...horse, mood: liveMoodFor(horse) };
      const url = codexModule.getCodexUrl(lookupHorse);
      if (url) return { type: 'codex', url, credit: 'Codex' };
    } catch (e) {}
  }

  // Ultimate fallback — CSS silhouette.
  return { type: 'silhouette', stageId: horse.stageId };
}

export function renderPortrait(horse, { size = 'md', className = '' } = {}) {
  const result = getPortraitForHorse(horse, { size });
  const breedAttr = horse.breed ? ` data-breed="${escapeAttr(horse.breed)}"` : '';
  const mood = liveMoodFor(horse);
  const moodColor = `var(--portrait-${mood}, transparent)`;

  if (result.type === 'codex') {
    // Codex is painterly / photoreal. No pixelated scaling.
    return `<span class="horse-portrait horse-portrait--codex horse-portrait--${size} ${className}" style="background-image: url('${result.url}'); background-color: ${moodColor}" data-horse-id="${escapeAttr(horse.id)}" data-breed="${escapeAttr(horse.breed || '')}" data-mood="${escapeAttr(mood)}" aria-hidden="true"></span>`;
  }

  if (result.type === 'portrait') {
    // Pixel-art: image-rendering: pixelated is set via .horse-portrait--pixel
    // so 64x64 sprites scale up without smoothing.
    return `<span class="horse-portrait horse-portrait--pixel horse-portrait--${size} ${className}" style="background-image: url('${result.url}'); background-color: ${moodColor}" data-horse-id="${escapeAttr(horse.id)}" data-breed="${escapeAttr(horse.breed || '')}" data-mood="${escapeAttr(mood)}" aria-hidden="true"></span>`;
  }

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
 * Idle animations only apply to pixel-art portraits (the .--pixel class).
 * Codex portraits are static — they don't animate.
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
    for (const el of document.querySelectorAll('.horse-portrait--pixel[data-breed]')) {
      if (hoveredHorseId && el.dataset.horseId === hoveredHorseId) continue;
      const breed = el.dataset.breed;
      const frames = animations[breed];
      if (!frames || !frames[idleFrameIndex]) continue;
      el.style.backgroundImage = `url('${frames[idleFrameIndex]}')`;
    }
  }, FRAME_MS);
}