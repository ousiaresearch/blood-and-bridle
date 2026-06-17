// Death and retirement memorials. When a horse leaves the herd (natural
// death at end of life, retirement to pasture, or sold/given away), the
// game keeps a short memorial record: the horse's profile, key moments
// from the log, and the circumstances of departure.
//
// Memorials accumulate on game.memorials and surface:
// - In the dashboard as a transient banner (newest first) when fresh
// - On the ending screen as a Memorial Hall
// - In the dynasty export/import as part of the saved game
//
// The buildMemorial() function is the single source of truth for what a
// memorial contains; the renderMemorialBanner() / renderMemorialHall()
// functions only shape it for display.

import { getLifeStage, breedById } from './horse.js';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Build a memorial record for a horse that has left the herd. Pure function.
 *
 * @param {Object} horse — the horse as it was just before leaving
 * @param {Object} game — the full game state (read-only)
 * @param {Object} [opts]
 * @param {'death'|'retirement'|'sold'|'auctioned'} [opts.kind='death'] — why they left
 * @param {string} [opts.circumstance] — short human note, e.g. "old age at the ranch"
 * @returns {{
 *   id: string,
 *   horseId: string,
 *   horseName: string,
 *   role: string,
 *   breed: string,
 *   breedLabel: string,
 *   temperament: string,
 *   age: number,
 *   kind: string,
 *   circumstance: string,
 *   epitaph: string,
 *   traits: Object,
 *   keyMoments: string[],
 *   portraitBreed: string,
 *   portraitStage: string,
 *   portraitMood: string,
 *   departedAt: { day: number, year: number, season: string },
 *   valueAtDeparture: number,
 *   legacy: number,
 * }}
 */
export function buildMemorial(horse, game, opts = {}) {
  if (!horse) return null;
  const breed = breedById(horse.breed);
  const stage = getLifeStage(horse);
  const kind = opts.kind ?? 'death';
  const circumstance = opts.circumstance ?? defaultCircumstance(kind, horse);

  return {
    id: `memorial-${horse.id}-${game?.day ?? 0}`,
    horseId: horse.id,
    horseName: horse.name,
    role: horse.role,
    breed: horse.breed,
    breedLabel: breed.label,
    temperament: horse.temperament,
    age: horse.age,
    kind,
    circumstance,
    epitaph: epitaphFor(kind, horse, breed, stage),
    traits: { ...(horse.traits ?? {}) },
    keyMoments: extractKeyMoments(horse, game),
    portraitBreed: horse.breed,
    portraitStage: stage?.id ?? 'retiree',
    portraitMood: 'calm', // memorials are always calm — the horse is at rest
    departedAt: {
      day: game?.day ?? 0,
      year: Math.floor(((game?.day ?? 0) - 1) / 30) + 1,
      season: seasonForDay(game?.day ?? 0),
    },
    valueAtDeparture: horse.value ?? 0,
    legacy: game?.legacy ?? 0,
  };
}

function defaultCircumstance(kind, horse) {
  switch (kind) {
    case 'death':
      return `Died at age ${horse.age}.`;
    case 'retirement':
      return `Retired at age ${horse.age}.`;
    case 'sold':
      return `Sold at age ${horse.age}.`;
    case 'auctioned':
      return `Sold at auction at age ${horse.age}.`;
    default:
      return `Left the ranch at age ${horse.age}.`;
  }
}

function epitaphFor(kind, horse, breed, stage) {
  // Short, breed-aware, kind-aware. The last line of a life.
  if (kind === 'death') {
    if (horse.age >= 13) return `A long run. The pasture is dimmer without ${horse.name}.`;
    if (horse.age >= 7) return `${horse.name} knew the work. The work will miss them.`;
    return `${horse.name} did not get the years. The years will remember.`;
  }
  if (kind === 'retirement') {
    return `${horse.name} earned the rest. The green pasture opens.`;
  }
  if (kind === 'sold' || kind === 'auctioned') {
    return `${horse.name} left the ranch. Someone else carries the name forward.`;
  }
  return `${horse.name} is gone.`;
}

function seasonForDay(day) {
  // Matches src/seasons.js: 30 days per season, 4 seasons.
  const dayOfYear = ((day - 1) % 120) + 1;
  if (dayOfYear <= 30) return 'Spring';
  if (dayOfYear <= 60) return 'Summer';
  if (dayOfYear <= 90) return 'Autumn';
  return 'Winter';
}

/**
 * Pull every log line that mentions this horse by name. We want the moments
 * that defined the life, not every routine day. Cap at 8 to keep the memorial
 * readable.
 */
function extractKeyMoments(horse, game) {
  if (!game?.log) return [];
  // Game log is most-recent-first. We want oldest → newest chronologically.
  const reversed = game.log.slice().reverse();
  const all = reversed.filter((line) => line.includes(horse.name));
  // Prefer "moment" lines: show wins, training milestones, breeding, death/retirement.
  // If we have fewer than 8 moments, fall back to any horse-mention line.
  const momentKeywords = ['won', 'placed', 'champion', 'retired', 'died', 'foal', 'bred', 'sold', 'foaled', 'payout', 'Voss', 'Mae', 'Eli', 'Reyes', 'trained', 'partner'];
  const moments = all.filter((line) => momentKeywords.some((k) => line.toLowerCase().includes(k.toLowerCase())));
  const pool = moments.length > 0 ? moments : all;
  return pool.slice(-8);
}

/**
 * Render a single memorial card for the dashboard banner or Memorial Hall.
 * Pass `compact: true` for the dashboard banner; pass `compact: false`
 * for the ending-screen hall.
 */
export function renderMemorial(memorial, { compact = false } = {}) {
  if (!memorial) return '';
  const cls = compact ? 'memorial memorial--banner' : 'memorial memorial--hall';
  const portrait = portraitPlaceholder(memorial);
  const moments = memorial.keyMoments.length === 0
    ? '<p class="hint">No moments on record.</p>'
    : `<ul class="memorial-moments">${memorial.keyMoments.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul>`;
  return `
    <article class="${cls}" data-memorial-id="${escapeHtml(memorial.id)}">
      <div class="memorial-portrait">${portrait}</div>
      <div class="memorial-body">
        <p class="memorial-kind">${escapeHtml(memorial.kind)} · ${escapeHtml(memorial.departedAt.season)} Y${memorial.departedAt.year}</p>
        <h3 class="memorial-name">${escapeHtml(memorial.horseName)}</h3>
        <p class="memorial-meta">${escapeHtml(memorial.breedLabel)} · ${escapeHtml(memorial.role)} · age ${memorial.age}</p>
        <p class="memorial-circumstance">${escapeHtml(memorial.circumstance)}</p>
        <p class="memorial-epitaph">"${escapeHtml(memorial.epitaph)}"</p>
        ${compact ? '' : moments}
      </div>
    </article>
  `;
}

// We don't import renderPortrait() here because memorials are pure-data
// and the rendering layer should be pluggable. Inline a mood-tinted
// silhouette placeholder; the dashboard / ending screens can swap in
// the actual portrait if the asset is available.
function portraitPlaceholder(memorial) {
  // 64x64 silhouette of the horse at the moment they left.
  // A real portrait could be loaded by id; the placeholder works without assets.
  return `<div class="memorial-silhouette" aria-hidden="true" data-breed="${escapeHtml(memorial.portraitBreed)}" data-stage="${escapeHtml(memorial.portraitStage)}" data-mood="${escapeHtml(memorial.portraitMood)}"></div>`;
}

/**
 * Render the list of memorials as a Memorial Hall block. Returns empty
 * string if there are no memorials.
 */
export function renderMemorialHall(memorials) {
  if (!memorials || memorials.length === 0) return '';
  // Newest first.
  const sorted = [...memorials].sort((a, b) => (b.departedAt.day ?? 0) - (a.departedAt.day ?? 0));
  return `
    <section class="memorial-hall">
      <h2 class="eyebrow">Memorial Hall</h2>
      <p class="hint">${sorted.length} ${sorted.length === 1 ? 'horse remembered' : 'horses remembered'}.</p>
      <div class="memorial-grid">
        ${sorted.map((m) => renderMemorial(m, { compact: false })).join('')}
      </div>
    </section>
  `;
}