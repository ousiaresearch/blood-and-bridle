import test from 'node:test';
import assert from 'node:assert/strict';

import {
  serializeGame,
  deserializeGame,
  parseJsonExport,
  buildShareLink,
  parseShareLink,
  suggestFilename,
  SCHEMA_VERSION,
} from '../src/dynasty.js';
import { createNewGame } from '../src/game.js';

test('serializeGame produces a schema-versioned export', () => {
  const game = createNewGame();
  const out = serializeGame(game);
  assert.equal(out.schema, SCHEMA_VERSION);
  assert.equal(typeof out.exportedAt, 'string');
  assert.ok(out.meta);
  assert.ok(out.state);
});

test('serializeGame.meta.summary is human readable', () => {
  const game = createNewGame();
  const out = serializeGame(game);
  assert.match(out.meta.summary, /Year 1 Spring/);
  assert.match(out.meta.summary, /\d+ horses/);
});

test('serializeGame round-trips losslessly through JSON', () => {
  const game = createNewGame();
  const out = serializeGame(game);
  const json = JSON.stringify(out);
  const back = parseJsonExport(json);
  assert.equal(back.ok, true);
  assert.deepEqual(back.game.horses.length, game.horses.length);
  assert.equal(back.game.cash, game.cash);
});

test('deserializeGame rejects wrong schema', () => {
  const bad = { schema: 999, state: {} };
  const result = deserializeGame(bad);
  assert.equal(result.ok, false);
  assert.match(result.error, /Schema version mismatch/);
});

test('deserializeGame rejects missing state', () => {
  const result = deserializeGame({ schema: 1 });
  assert.equal(result.ok, false);
  assert.match(result.error, /Missing state/);
});

test('deserializeGame rejects missing required field', () => {
  const result = deserializeGame({ schema: 1, state: { day: 1 } });
  assert.equal(result.ok, false);
  assert.match(result.error, /Missing required field: horses/);
});

test('deserializeGame rejects non-array horses', () => {
  const result = deserializeGame({ schema: 1, state: { day: 1, horses: 'nope', staff: [], cash: 0, legacy: 0, reputation: 0 } });
  assert.equal(result.ok, false);
  assert.match(result.error, /horses must be an array/);
});

test('parseJsonExport catches invalid JSON', () => {
  const result = parseJsonExport('{not valid');
  assert.equal(result.ok, false);
  assert.match(result.error, /Invalid JSON/);
});

test('buildShareLink produces a URL with compact params', () => {
  const game = createNewGame();
  const url = buildShareLink(game, 'https://ranch.example/');
  assert.match(url, /^https:\/\/ranch\.example\/#/);
  assert.match(url, /y=1/);
  assert.match(url, /s=Spring/);
  assert.match(url, /d=/);
  assert.match(url, /score=/);
  assert.match(url, /horses=5/);
  assert.match(url, /top=/);
});

test('buildShareLink includes top 3 horses by training', () => {
  const game = createNewGame();
  const url = buildShareLink(game);
  // Top horse by training should be one of the named starting herd.
  // URLSearchParams uses + for spaces, so we match either form.
  assert.match(url, /top=(Blue(\+|%20)Ash|Mercy(\+|%20)Road|Juniper(\+|%20)Smoke|Red(\+|%20)Ledger|Sunday(\+|%20)Caller)/);
});

test('parseShareLink returns null for empty hash', () => {
  assert.equal(parseShareLink(''), null);
  assert.equal(parseShareLink('#'), null);
});

test('parseShareLink returns null for malformed hash', () => {
  assert.equal(parseShareLink('#garbage'), null);
  assert.equal(parseShareLink('#y=abc'), null);
});

test('parseShareLink round-trips a share link', () => {
  const game = createNewGame();
  const url = buildShareLink(game);
  const hash = url.split('#')[1];
  const snap = parseShareLink(hash);
  assert.ok(snap);
  assert.equal(snap.year, 1);
  assert.equal(snap.season, 'Spring');
  assert.equal(snap.horseCount, 5);
  assert.ok(Array.isArray(snap.topHorses));
  assert.ok(snap.topHorses.length > 0);
});

test('suggestFilename uses the top horse name', () => {
  const game = createNewGame();
  const name = suggestFilename(game);
  assert.match(name, /^blood-and-bridle-y1-/);
  assert.match(name, /\.json$/);
  assert.ok(!name.includes(' '), 'filename should be slug-safe');
});

test('suggestFilename falls back gracefully on a horse-less game', () => {
  const name = suggestFilename({ day: 1, horses: [], cash: 0, legacy: 0, reputation: 0 });
  assert.match(name, /^blood-and-bridle-y1-dynasty\.json$/);
});

test('serializeGame throws on non-object input', () => {
  assert.throws(() => serializeGame(null), /not an object/);
  assert.throws(() => serializeGame('nope'), /not an object/);
});
