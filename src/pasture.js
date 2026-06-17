// The Pasture view.
//
// Re-organize the herd grid from a card grid into fenced paddocks
// sorted by life stage. Paddocks are: foals (smallest), yearlings,
// prospects, campaigners (largest), retirees (back pasture). The
// legendary horse, when present, gets its own paddock at the front.
//
// Each paddock has a header (stage label, count) and the horses are
// rendered inside. Hover, double-click, select, all still work — the
// paddock is a layout, not a UI change in behavior.

import { renderPortrait } from './portraits.js';

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const STAGE_PADDOCKS = [
  { id: 'legendary', label: 'The Picturebook Horse', fence: 'iron', capacity: 1 },
  { id: 'campaigner', label: 'Campaigners', fence: 'wood', capacity: 6 },
  { id: 'two_year_old', label: 'Two-year-olds', fence: 'wood', capacity: 4 },
  { id: 'yearling', label: 'Yearlings', fence: 'wood', capacity: 4 },
  { id: 'foal', label: 'Foals & Weanlings', fence: 'wood', capacity: 4 },
  { id: 'retiree', label: 'Back Pasture', fence: 'old-wood', capacity: 6 },
];

function horseForPaddock(horse) {
  if (horse.legendary) return 'legendary';
  return horse.stageId ?? horse.lifeStageId ?? 'campaigner';
}

function renderPaddockHorse(horse, selectedHorseId) {
  const selected = horse.id === selectedHorseId ? 'card--selected' : '';
  const portraitHtml = renderPortrait(horse, { size: 'md' });
  return `
    <button class="pasture-horse card ${selected}" data-select-horse="${escapeHtml(horse.id)}">
      ${portraitHtml}
      <strong>${escapeHtml(horse.name)}</strong>
      <small>${escapeHtml(horse.role)} · age ${horse.age}</small>
    </button>
  `;
}

export function renderPasture(horses, selectedHorseId) {
  if (!horses || horses.length === 0) {
    return '<p class="hint">No horses in the herd yet. The barn is too quiet.</p>';
  }

  // Group horses by paddock id, preserving order.
  const paddocks = new Map();
  for (const id of STAGE_PADDOCKS.map((p) => p.id)) paddocks.set(id, []);
  for (const horse of horses) {
    const pid = horseForPaddock(horse);
    if (!paddocks.has(pid)) paddocks.set(pid, []);
    paddocks.get(pid).push(horse);
  }

  const sections = STAGE_PADDOCKS.map((p) => {
    const list = paddocks.get(p.id) ?? [];
    if (list.length === 0) return '';
    return `
      <section class="pasture-paddock pasture-paddock--${p.id} pasture-fence--${p.fence}" data-paddock="${p.id}">
        <header class="pasture-paddock-head">
          <p class="eyebrow">${escapeHtml(p.label)}</p>
          <small class="hint">${list.length} ${list.length === 1 ? 'horse' : 'horses'}</small>
        </header>
        <div class="pasture-paddock-grid">
          ${list.map((h) => renderPaddockHorse(h, selectedHorseId)).join('')}
        </div>
      </section>
    `;
  }).filter(Boolean).join('');

  return `<div class="pasture">${sections}</div>`;
}