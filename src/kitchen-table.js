// Blood & Bridle — the kitchen table.
//
// This is the presentation layer for the moral/critical-decision scenes
// in src/scenes.js. The bunkhouse modal renders the scene background,
// the speakers with their portraits and lines, and the choices as
// buttons. When the player picks a choice, the choice's effects are
// applied to the game state by the caller (src/app.js wires this up
// via applyKitchenChoice).

import { resolveSceneDialogue } from './scenes.js';
import { HAND_VOICES } from './hands-voice.js';
import { showModal, closeModal } from './modal.js';
import { renderHeirPortrait } from './rival-portraits.js';

/**
 * Open the kitchen table scene modal.
 *
 * @param {object} scene - a scene record from KITCHEN_SCENES
 * @param {object} game - the live game state (hands, etc.)
 * @param {function} applyEffect - callback that applies a choice's
 *   effects to the game state. Called with (effects, sceneId, choiceId).
 * @param {object} [opts]
 * @param {object} [opts.audio] - the audio engine (for stinger cues)
 *
 * Returns the showModal handle. The caller is responsible for any
 * post-modal flow (log lines, season tick, etc).
 */
export function openKitchenTable(scene, game, applyEffect, opts = {}) {
  if (!scene) return null;
  const audio = opts.audio ?? null;
  const html = renderKitchenTable(scene, game);

  const handle = showModal(html, {
    title: scene.label,
    width: 'wide',
  });

  // Phase 14 — stinger cues. The kitchen table has its own acoustic:
  // a wooden floor, a coffee pot, an AM radio two rooms over. We
  // play a chairScrape when the modal opens (the player sits down)
  // and the radio hum in the background for the duration of the
  // scene. Heir scenes also get a wind cue — those often happen
  // outdoors.
  if (typeof window !== 'undefined') {
    audio?.play?.('chairScrape');
    if (scene.id?.startsWith('heir-')) {
      audio?.play?.('windDistant');
    }
  }

  // Wire the choice buttons. Each button has data-choice="<id>".
  const overlay = document.querySelector('.modal-overlay');
  for (const choice of scene.choices) {
    const btn = overlay.querySelector(`[data-choice="${choice.id}"]`);
    if (!btn) continue;
    btn.addEventListener('click', () => {
      try {
        applyEffect(choice.effects, scene.id, choice.id);
      } catch (e) {
        console.error('Kitchen table choice effect failed:', e);
      }
      // Phase 14 — chair pushes back, door closes.
      audio?.play?.('chairScrape');
      audio?.play?.('doorClose');
      closeModal();
    });
  }

  return handle;
}

/**
 * Pure renderer — returns the HTML string for the scene modal.
 *
 * Exposed so app.js can pre-render or test, and so the kitchen-table
 * modal can be embedded in other surfaces (event modals, the season
 * summary) if needed.
 *
 * Phase 13 — heir scenes get the heir portrait rendered into the
 * scene header, so the player sees the new generation's face
 * across the table from them.
 */
export function renderKitchenTable(scene, game) {
  const hands = game?.hands ?? [];
  const dialogue = resolveSceneDialogue(scene, hands);

  // Phase 13 — heir scenes (heir-arrival, heir-departure,
  // heir-kitchen-table) get an heir portrait in the scene header.
  // Falls back to an empty string for non-heir scenes.
  const isHeirScene = scene.id?.startsWith('heir-') ?? false;
  const heirPortraitHtml = (isHeirScene && game?.heirArchetypeKey)
    ? `<div class="kt-heir-portrait" data-heir-archetype="${game.heirArchetypeKey}">
        ${renderHeirPortrait(game, { size: 'lg', className: 'kt-heir-portrait-img' })}
        <p class="kt-heir-portrait-caption">${escapeHtml(game.ownerName ?? 'The heir')}</p>
      </div>`
    : '';

  const speakersHtml = dialogue.map((d) => {
    const voice = HAND_VOICES[d.handId];
    const portraitSrc = voice?.portraitBase
      ? `${voice.portraitBase}_${d.mood}.png`
      : null;
    const portraitHtml = portraitSrc
      ? `<img class="kt-portrait-img" src="${portraitSrc}" alt="${escapeAttr(d.handName)}" />`
      : `<span class="kt-portrait-placeholder" aria-hidden="true">${escapeHtml(initialsOf(d.handName))}</span>`;
    return `
      <div class="kt-speaker kt-speaker--${escapeAttr(d.handId)}" data-mood="${escapeAttr(d.mood)}">
        <div class="kt-portrait-frame">${portraitHtml}</div>
        <div class="kt-speaker-bubble">
          <p class="kt-speaker-name">${escapeHtml(d.handName)}</p>
          <p class="kt-speaker-line">${escapeHtml(d.line)}</p>
        </div>
      </div>
    `;
  }).join('');

  const backgroundHtml = scene.background
    ? `<div class="kt-background" role="presentation" style="background-image: url('${escapeAttr(scene.background)}')"></div>`
    : `<div class="kt-background kt-background--placeholder" role="presentation" aria-hidden="true"></div>`;

  const choicesHtml = scene.choices.map((c) =>
    `<button type="button" class="action kt-choice" data-choice="${escapeAttr(c.id)}">${escapeHtml(c.label)}</button>`
  ).join('');

  return `
    <div class="kt-scene" data-scene="${escapeAttr(scene.id)}">
      ${backgroundHtml}
      <div class="kt-overlay" aria-hidden="true"></div>
      <div class="kt-content">
        ${heirPortraitHtml}
        <p class="kt-setup">${escapeHtml(scene.setup)}</p>
        <div class="kt-speakers">${speakersHtml || '<p class="kt-silent">Nobody speaks.</p>'}</div>
        <div class="kt-choices">${choicesHtml}</div>
      </div>
    </div>
  `;
}

function initialsOf(name) {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}