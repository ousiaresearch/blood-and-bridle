// Horse detail modal content. Renders a deep profile of one horse: large
// portrait, full stats, traits with bars, lineage tree, and a season
// chronicle drawn from the game log. Pure function — returns HTML string.

import { INHERITABLE_TRAITS, getLifeStage, breedById, liveMoodFor } from './horse.js';
import { renderPortrait } from './portraits.js';
import { buildLineageModel } from './lineage.js';
import { renderLetterhead, renderBrandGlyph } from './brand.js';

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
    <article class="bill-of-sale" data-horse-id="${escapeHtml(horse.id)}" data-mood="${escapeHtml(mood)}">
      <header class="bill-head">
        ${renderLetterhead({
          ranchBrand: game.ranchBrand || 'y-bar',
          ranchName: game.ranchName || 'Unbranded',
          ownerName: game.ownerName,
          ownerPronouns: game.ownerPronouns,
          foundedDay: game.foundedDay,
        })}
        <h2 class="bill-title">REGISTRATION</h2>
        <p class="bill-subtitle">No. ${escapeHtml(horse.id.slice(-6).toUpperCase())} · Filed ${escapeHtml(stage?.label ?? '')} of age ${horse.age}</p>
      </header>

      <div class="bill-body">
        <div class="bill-portrait-block">
          ${renderPortrait(horse, { size: 'xl', className: 'detail-portrait' })}
          <div class="bill-stamp">${renderBrandGlyph(game.ranchBrand || 'y-bar', 'bill-stamp-glyph')}</div>
        </div>

        <div class="bill-fields">
          <h3 class="bill-name">${escapeHtml(horse.name)} ${injuryBadge} ${moodBadge}</h3>
          <dl class="bill-grid">
            <div><dt>Role</dt><dd>${escapeHtml(horse.role)}</dd></div>
            <div><dt>Breed</dt><dd>${escapeHtml(breed.label)}</dd></div>
            <div><dt>Bloodline</dt><dd>${escapeHtml(horse.bloodline)}</dd></div>
            <div><dt>Sex</dt><dd>${escapeHtml(horse.sex)}</dd></div>
            <div><dt>Age</dt><dd>${horse.age}</dd></div>
            <div><dt>Stage</dt><dd>${escapeHtml(stage?.label ?? '—')}</dd></div>
            <div><dt>Value</dt><dd>$${(horse.value ?? 0).toLocaleString()}</dd></div>
            <div><dt>Mood</dt><dd>${escapeHtml(mood)}</dd></div>
          </dl>
        </div>
      </div>

      <section class="bill-section">
        <h3 class="eyebrow">Stats</h3>
        <div class="detail-stats">${stats}</div>
      </section>

      <section class="bill-section">
        <h3 class="eyebrow">Traits</h3>
        <div class="detail-traits">${traits}</div>
      </section>

      <section class="bill-section">
        <h3 class="eyebrow">Personality</h3>
        <p class="detail-temperament">${escapeHtml(horse.temperament)}</p>
      </section>

      <section class="bill-section">
        <h3 class="eyebrow">Lineage</h3>
        ${lineageHtml}
      </section>

      <section class="bill-section">
        <h3 class="eyebrow">Chronicle</h3>
        ${chronicleHtml}
      </section>

      <footer class="bill-footer">
        <p>Stamped at the gate. The brand rides with the horse.</p>
      </footer>
    </article>
  `;
}
