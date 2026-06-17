// Horse detail modal content. Renders a deep profile of one horse: large
// portrait, full stats, traits with bars, lineage tree, and a season
// chronicle drawn from the game log. Pure function — returns HTML string.

import { INHERITABLE_TRAITS, getLifeStage, breedById, liveMoodFor } from './horse.js';
import { renderPortrait } from './portraits.js';
import { buildLineageModel } from './lineage.js';

const STAT_KEYS = [
  { key: 'training', label: 'Training', color: 'gold' },
  { key: 'bond',     label: 'Bond',     color: 'green' },
  { key: 'health',   label: 'Health',   color: 'blue' },
  { key: 'stress',   label: 'Stress',   color: 'red' },
];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function statBar(value, color) {
  const pct = Math.max(0, Math.min(100, value));
  return `<div class="trait-bar trait-bar--${color}"><span class="trait-bar-fill" style="width: ${pct}%"></span><span class="trait-bar-text">${pct}</span></div>`;
}

/**
 * Extract every log line that mentions this horse by name, with timestamps.
 * This is the "season chronicle" — the moments the player remembers.
 */
function buildChronicle(game, horse) {
  if (!game.log) return [];
  // Game log is most-recent-first; we want chronologically oldest → newest.
  const reversed = game.log.slice().reverse();
  return reversed
    .map((line, idx) => ({ day: game.day - idx, line }))
    .filter(({ line }) => line.includes(horse.name));
}

/**
 * Renders the modal content for a horse. Caller wraps in showModal().
 * Returns HTML string.
 */
export function renderHorseDetail(horse, game) {
  if (!horse) return '<p class="hint">No horse selected.</p>';

  const stage = getLifeStage(horse);
  const breed = breedById(horse.breed);
  const mood = liveMoodFor(horse);
  const lineage = buildLineageModel(game, horse.id);
  const chronicle = buildChronicle(game, horse);

  const stats = STAT_KEYS.map(({ key, label, color }) => `
    <div class="detail-stat">
      <span class="detail-stat-label">${label}</span>
      ${statBar(horse[key] ?? 0, color)}
      <span class="detail-stat-value">${horse[key] ?? 0}</span>
    </div>
  `).join('');

  const traits = Object.entries(INHERITABLE_TRAITS).map(([key, config]) => {
    const v = horse.traits?.[key] ?? 0;
    return `
      <div class="detail-trait">
        <span class="detail-trait-label">${escapeHtml(config.label)}</span>
        ${statBar(v, 'gold')}
        <span class="detail-trait-value">${v}</span>
      </div>
    `;
  }).join('');

  const injuryBadge = horse.injured ? '<span class="detail-badge detail-badge--injured">Injured</span>' : '';
  const moodBadge = `<span class="detail-badge detail-badge--mood" data-mood="${escapeHtml(mood)}">${escapeHtml(mood)}</span>`;

  const sire = horse.parents?.[0] ? (game.horses.find((h) => h.id === horse.parents[0]) ?? null) : null;
  const dam = horse.parents?.[1] ? (game.horses.find((h) => h.id === horse.parents[1]) ?? null) : null;
  const lineageHtml = `
    <div class="detail-lineage">
      <div class="detail-lineage-row">
        ${sire ? `
          <div class="detail-lineage-cell">
            <span class="eyebrow">Sire</span>
            ${renderPortrait(sire, { size: 'sm' })}
            <button class="lineage-link" data-detail-horse="${escapeHtml(sire.id)}">${escapeHtml(sire.name)}</button>
            <small>age ${sire.age}</small>
          </div>
        ` : `<div class="detail-lineage-cell"><span class="eyebrow">Sire</span><span class="hint">Unknown</span></div>`}
        <span class="breed-x">×</span>
        ${dam ? `
          <div class="detail-lineage-cell">
            <span class="eyebrow">Dam</span>
            ${renderPortrait(dam, { size: 'sm' })}
            <button class="lineage-link" data-detail-horse="${escapeHtml(dam.id)}">${escapeHtml(dam.name)}</button>
            <small>age ${dam.age}</small>
          </div>
        ` : `<div class="detail-lineage-cell"><span class="eyebrow">Dam</span><span class="hint">Unknown</span></div>`}
      </div>
      ${lineage?.offspring?.length ? `
        <div class="detail-lineage-row">
          <div class="detail-lineage-cell detail-lineage-cell--wide">
            <span class="eyebrow">Offspring (${lineage.offspring.length})</span>
            <ul class="detail-offspring">
              ${lineage.offspring.map((o) => `
                <li>
                  <button class="lineage-link" data-detail-horse="${escapeHtml(o.id)}">${escapeHtml(o.name)}</button>
                  <small>age ${o.age}</small>
                </li>
              `).join('')}
            </ul>
          </div>
        </div>
      ` : ''}
    </div>
  `;

  const chronicleHtml = chronicle.length === 0
    ? '<p class="hint">No moments on record yet.</p>'
    : `<ul class="detail-chronicle">${chronicle.map((c) => `<li>${escapeHtml(c.line)}</li>`).join('')}</ul>`;

  return `
    <div class="horse-detail" data-horse-id="${escapeHtml(horse.id)}" data-mood="${escapeHtml(mood)}">
      <div class="detail-portrait-block">
        ${renderPortrait(horse, { size: 'xl', className: 'detail-portrait' })}
        <h2 class="detail-name">${escapeHtml(horse.name)} ${injuryBadge} ${moodBadge}</h2>
        <p class="detail-role">${escapeHtml(horse.role)} · ${escapeHtml(breed.label)}</p>
        <p class="detail-bloodline">${escapeHtml(horse.bloodline)}</p>
        <p class="detail-meta">age ${horse.age} · ${escapeHtml(stage?.label ?? '—')} · ${escapeHtml(horse.sex)}</p>
      </div>

      <section class="detail-section">
        <h3 class="eyebrow">Stats</h3>
        <div class="detail-stats">${stats}</div>
        <p class="detail-value">Value: $${(horse.value ?? 0).toLocaleString()}</p>
      </section>

      <section class="detail-section">
        <h3 class="eyebrow">Traits</h3>
        <div class="detail-traits">${traits}</div>
      </section>

      <section class="detail-section">
        <h3 class="eyebrow">Personality</h3>
        <p class="detail-temperament">"${escapeHtml(horse.temperament)}"</p>
      </section>

      <section class="detail-section">
        <h3 class="eyebrow">Lineage</h3>
        ${lineageHtml}
      </section>

      <section class="detail-section">
        <h3 class="eyebrow">Chronicle</h3>
        ${chronicleHtml}
      </section>
    </div>
  `;
}
