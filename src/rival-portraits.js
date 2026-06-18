// Rival & family portrait registry.
//
// Wires the Codex-generated mood portraits (assets/people/rivals/*.png
// and assets/people/heirs/*.png) into the game's data model so they
// surface in:
//   - the auction preview (per-bidder portrait next to their bid)
//   - the community panel (per-neighbor portrait)
//   - the heir transition (per-generation child portrait)
//   - the kitchen-table scene where the rival is a speaker
//
// Resolution priority:
//   - exact (rivalId, mood) match → use it
//   - exact rivalId, fallback to 'neutral' mood
//   - both miss → null (caller renders initial-letter placeholder)
//
// Pure module. No DOM. No localStorage. Single source of truth for
// how rival ids map to on-disk portraits.

const MOODS = Object.freeze(['neutral', 'concerned', 'arguing']);

// ── Rival ranchers (the four family rivals + Ash Coulee foreman) ──
const RIVAL_PORTRAITS = Object.freeze({
  'cobb-blood': {
    name: 'Cobb Blood',
    family: true,
    archetype: 'dispersaler',
    base: '/assets/people/rivals/cobb',
    defaultMood: 'neutral',
  },
  'william-blood': {
    name: 'William Blood',
    family: true,
    archetype: 'show-circuit',
    base: '/assets/people/rivals/william',
    defaultMood: 'neutral',
  },
  'edith-crane': {
    name: 'Edith Crane',
    family: true,
    archetype: 'cattle-rancher',
    base: '/assets/people/rivals/edith',
    defaultMood: 'neutral',
  },
  'henry-whitehorse': {
    name: 'Henry Whitehorse',
    family: false,
    archetype: 'working-ranch',
    base: '/assets/people/rivals/henry',
    defaultMood: 'neutral',
  },
});

// Aliases — the same person can be referenced by different ids in
// different systems (auction.js uses 'bidder-cobb', community.js uses
// 'neighbor-william-blood', blood-family.js uses 'william-blood').
// All three should resolve to the same portrait.
const RIVAL_ID_ALIASES = Object.freeze({
  // Auction system → canonical
  'bidder-cobb':        'cobb-blood',
  'bidder-whitehorse':  'henry-whitehorse',
  // Community system → canonical
  'neighbor-william-blood': 'william-blood',
  'neighbor-edith-crane':   'edith-crane',
  'neighbor-ash-coulee':    'henry-whitehorse',
});

// ── Heir archetypes (next generation) ──
// Each is a pool from which the heir transition picks one based on
// (a) who the heir is and (b) which family relation slot is empty.
const HEIR_PORTRAITS = Object.freeze({
  son:      { name: 'Your son',      base: '/assets/people/heirs/son',      defaultMood: 'neutral' },
  daughter: { name: 'Your daughter', base: '/assets/people/heirs/daughter', defaultMood: 'neutral' },
  nephew:   { name: 'Your nephew',   base: '/assets/people/heirs/nephew',   defaultMood: 'neutral' },
  niece:    { name: 'Your niece',    base: '/assets/people/heirs/niece',    defaultMood: 'neutral' },
});

// Heir transition: which archetype the heir takes on. Mae (head trainer)
// has no blood relation, so she picks son-or-daughter. Eli is the
// ranch-hand uncle archetype → nephew-or-niece. Reyes → nephew (the
// cowboy lineage). Elena → niece (the keeper of the books).
const HEIR_ARCHETYPE_MAP = Object.freeze({
  mae:           ['son', 'daughter'],
  eli:           ['nephew', 'niece'],
  reyes:         ['nephew', 'son'],
  elena:         ['niece', 'daughter'],
  'cordell-voss':['nephew', 'son'],
});

// ── Resolution ─────────────────────────────────────────────────────

/**
 * Resolve the canonical portrait record for a rival id, applying
 * any alias. Returns null if the id is unknown.
 */
export function portraitForRival(rivalId) {
  const canonical = RIVAL_ID_ALIASES[rivalId] ?? rivalId;
  return RIVAL_PORTRAITS[canonical] ?? null;
}

/**
 * Pick a mood for a rival in a given context. Moods are picked
 * deterministically when given a seed (e.g. auction outcome), randomly
 * otherwise. This is what makes Cobb's portrait in the auction preview
 * match the mood of his bid.
 *
 * @param {string} rivalId - any accepted id (bidder-*, neighbor-*, or canonical)
 * @param {object} [opts]
 * @param {string} [opts.mood] - explicit mood override ('neutral'|'concerned'|'arguing')
 * @param {string} [opts.context] - 'auction'|'community'|'kitchen'|'auction-loss'
 * @returns {string|null} the mood, or null if no portrait
 */
export function moodForRival(rivalId, opts = {}) {
  const portrait = portraitForRival(rivalId);
  if (!portrait) return null;
  if (opts.mood && MOODS.includes(opts.mood)) return opts.mood;

  const context = opts.context ?? 'community';
  // Auction outcomes drive mood: highest bidder is calm, losing bidder
  // is concerned; if the rival just bought a horse from the player,
  // they're arguing (the dispersal got them another one).
  if (context === 'auction')        return 'neutral';
  if (context === 'auction-loss')   return 'concerned';
  if (context === 'auction-won-player-loses') return 'arguing';
  if (context === 'kitchen')        return 'neutral';
  // Default: neutral
  return portrait.defaultMood ?? 'neutral';
}

/**
 * Get the full portrait URL for a rival in a given mood. Returns null
 * if the rival id has no portrait registered.
 */
export function getRivalPortraitUrl(rivalId, opts = {}) {
  const portrait = portraitForRival(rivalId);
  if (!portrait) return null;
  const mood = moodForRival(rivalId, opts);
  if (!mood) return null;
  return `${portrait.base}_${mood}.png`;
}

/**
 * Render the rival portrait as inline HTML. Returns the placeholder
 * initials block when no portrait is registered.
 *
 * @param {string} rivalId
 * @param {object} [opts]
 * @param {string} [opts.size] - 'sm'|'md'|'lg' (default 'md')
 * @param {string} [opts.className] - additional CSS class
 * @param {string} [opts.mood] - explicit mood
 * @param {string} [opts.context] - context hint
 */
export function renderRivalPortrait(rivalId, opts = {}) {
  const portrait = portraitForRival(rivalId);
  if (!portrait) {
    // No portrait registered. Render initials placeholder.
    const name = opts.name ?? rivalId;
    const initials = initialsOf(name);
    const size = opts.size ?? 'md';
    return `<span class="rival-portrait rival-portrait--placeholder rival-portrait--${size} ${opts.className ?? ''}" data-rival-id="${escapeAttr(rivalId)}" aria-label="${escapeAttr(name)}">${escapeHtml(initials)}</span>`;
  }

  const url = getRivalPortraitUrl(rivalId, opts);
  const mood = moodForRival(rivalId, opts);
  const size = opts.size ?? 'md';
  return `<img class="rival-portrait rival-portrait--${size} ${opts.className ?? ''}" src="${escapeAttr(url)}" alt="${escapeAttr(portrait.name)}" data-rival-id="${escapeAttr(rivalId)}" data-mood="${escapeAttr(mood)}" data-archetype="${escapeAttr(portrait.archetype)}" />`;
}

// ── Heir portrait API ──────────────────────────────────────────────

/**
 * Pick an heir archetype from the pool that matches the heir id.
 * Deterministic based on (heirId + generationCount) so the same
 * playthrough always picks the same child.
 *
 * @param {string} heirId - the hand id (mae, eli, reyes, elena, cordell-voss)
 * @param {number} [generation=1] - the generation count (1=first heir)
 * @returns {{key: string, name: string, base: string, defaultMood: string}|null}
 */
export function pickHeirArchetype(heirId, generation = 1) {
  const pool = HEIR_ARCHETYPE_MAP[heirId];
  if (!pool || pool.length === 0) return null;
  // Deterministic pick: hash heirId + generation, mod by pool size.
  const seed = (heirId.charCodeAt(0) * 31 + (generation * 7)) % pool.length;
  const key = pool[seed];
  const record = HEIR_PORTRAITS[key];
  return record ? { key, ...record } : null;
}

/**
 * Get the portrait URL for a generation's heir. Picks the archetype
 * if none chosen yet (stored on the game state).
 *
 * @param {object} game
 * @returns {string|null}
 */
export function getHeirPortraitUrl(game) {
  if (!game?.heirArchetypeKey) return null;
  const record = HEIR_PORTRAITS[game.heirArchetypeKey];
  if (!record) return null;
  const mood = game.heirArchetypeMood ?? record.defaultMood;
  return `${record.base}_${mood}.png`;
}

export function renderHeirPortrait(game, opts = {}) {
  const url = getHeirPortraitUrl(game);
  const key = game?.heirArchetypeKey;
  const record = key ? HEIR_PORTRAITS[key] : null;
  const name = record?.name ?? game?.ownerName ?? 'The heir';
  const size = opts.size ?? 'lg';

  if (!url) {
    return `<span class="heir-portrait heir-portrait--placeholder heir-portrait--${size} ${opts.className ?? ''}" aria-label="${escapeAttr(name)}">${escapeHtml(initialsOf(name))}</span>`;
  }
  return `<img class="heir-portrait heir-portrait--${size} ${opts.className ?? ''}" src="${escapeAttr(url)}" alt="${escapeAttr(name)}" data-heir-archetype="${escapeAttr(key)}" data-mood="${escapeAttr(game?.heirArchetypeMood ?? 'neutral')}" />`;
}

// ── Lists for iteration ────────────────────────────────────────────

export function listRivalsWithPortraits() {
  return Object.entries(RIVAL_PORTRAITS).map(([id, p]) => ({ id, ...p }));
}

export function listHeirArchetypes() {
  return Object.entries(HEIR_PORTRAITS).map(([key, p]) => ({ key, ...p }));
}

export function listRivalAliases() {
  return Object.entries(RIVAL_ID_ALIASES).map(([alias, canonical]) => ({ alias, canonical }));
}

export const RIVAL_MOODS = MOODS;

// ── Helpers ────────────────────────────────────────────────────────

function initialsOf(name) {
  return String(name ?? '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}