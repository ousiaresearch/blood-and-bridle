// Dynasty export/import/share-link. Portable, versioned, deterministic.
//
// Goals:
//   - JSON export is human-readable and round-trips losslessly
//   - Share-link is compact: just enough to recognize a dynasty, not a full save
//   - Schema is versioned so future versions can migrate
//
// This module is pure. No DOM, no localStorage. Wire it from app.js.

export const SCHEMA_VERSION = 1;

const REQUIRED_TOP_LEVEL = ['day', 'horses', 'staff', 'cash', 'legacy', 'reputation'];

// Pure: produce a portable representation of a game state.
export function serializeGame(game) {
  if (!game || typeof game !== 'object') {
    throw new Error('serializeGame: game is not an object');
  }
  return {
    schema: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    meta: buildMeta(game),
    state: deepClone(game),
  };
}

function buildMeta(game) {
  const year = Math.floor((game.day - 1) / 120) + 1;
  const seasonIndex = Math.floor(((game.day - 1) % 120) / 30);
  const seasons = ['Spring', 'Summer', 'Fall', 'Winter'];
  const summary = `${year > 5 ? 'Post-game' : `Year ${year}`} ${seasons[seasonIndex] ?? '?'} · ${game.horses.length} horses · score ${formatScore(game)}`;
  return {
    year,
    season: seasons[seasonIndex] ?? 'Unknown',
    day: game.day,
    cash: game.cash,
    legacy: game.legacy,
    reputation: game.reputation,
    score: scoreOf(game),
    horseCount: game.horses.length,
    summary,
  };
}

function scoreOf(game) {
  // A reasonable score proxy: legacy × 1000 + reputation × 200 + cash + sum(value(horses))
  const horseValue = (game.horses ?? []).reduce((acc, h) => acc + (h.value ?? 0), 0);
  return (game.legacy ?? 0) * 1000 + (game.reputation ?? 0) * 200 + (game.cash ?? 0) + horseValue;
}

function formatScore(game) {
  return scoreOf(game).toLocaleString();
}

function deepClone(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(deepClone);
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = deepClone(v);
  return out;
}

// Pure: validate a parsed JSON object and return either { ok: true, game }
// or { ok: false, error: string }.
export function deserializeGame(json) {
  if (!json || typeof json !== 'object') {
    return { ok: false, error: 'Not a JSON object' };
  }
  if (json.schema !== SCHEMA_VERSION) {
    return { ok: false, error: `Schema version mismatch (got ${json.schema}, expected ${SCHEMA_VERSION})` };
  }
  if (!json.state || typeof json.state !== 'object') {
    return { ok: false, error: 'Missing state block' };
  }
  for (const key of REQUIRED_TOP_LEVEL) {
    if (!(key in json.state)) {
      return { ok: false, error: `Missing required field: ${key}` };
    }
  }
  if (!Array.isArray(json.state.horses)) {
    return { ok: false, error: 'state.horses must be an array' };
  }
  if (!Array.isArray(json.state.staff)) {
    return { ok: false, error: 'state.staff must be an array' };
  }
  return { ok: true, game: json.state };
}

// Pure: parse a JSON string and validate. Returns { ok, game | error }.
export function parseJsonExport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${e.message}` };
  }
  return deserializeGame(parsed);
}

// Build a shareable URL hash from a game state. Compact: just enough to
// recognize a dynasty, not a full save.
export function buildShareLink(game, baseUrl = 'https://example.invalid/') {
  if (!game) return baseUrl;
  const meta = buildMeta(game);
  const params = new URLSearchParams();
  params.set('y', String(meta.year));
  params.set('s', meta.season);
  params.set('d', String(meta.day));
  params.set('score', String(meta.score));
  params.set('horses', String(meta.horseCount));
  // Top 3 horses by training (or all if fewer)
  const top = [...(game.horses ?? [])]
    .sort((a, b) => (b.training ?? 0) - (a.training ?? 0))
    .slice(0, 3)
    .map((h) => h.name)
    .join(',');
  if (top) params.set('top', top);
  return `${baseUrl}#${params.toString()}`;
}

// Parse a URL hash back into a shareable snapshot.
export function parseShareLink(hash) {
  if (!hash || hash === '#') return null;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const y = Number(params.get('y'));
  const s = params.get('s');
  const d = Number(params.get('d'));
  const score = Number(params.get('score'));
  const horses = Number(params.get('horses'));
  const top = params.get('top') || '';
  if (!Number.isFinite(y) || !s || !Number.isFinite(d)) return null;
  return {
    year: y,
    season: s,
    day: d,
    score: Number.isFinite(score) ? score : 0,
    horseCount: Number.isFinite(horses) ? horses : 0,
    topHorses: top ? top.split(',') : [],
  };
}

// Pure: suggested filename for an exported dynasty.
export function suggestFilename(game) {
  if (!game) return 'blood-and-bridle-dynasty.json';
  const meta = buildMeta(game);
  const topHorse = (game.horses ?? [])
    .sort((a, b) => (b.training ?? 0) - (a.training ?? 0))[0]?.name ?? 'dynasty';
  const safe = topHorse.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `blood-and-bridle-y${meta.year}-${safe}.json`;
}

export const __INTERNAL__ = { buildMeta, scoreOf, REQUIRED_TOP_LEVEL };
