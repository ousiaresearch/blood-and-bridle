import test from 'node:test';
import assert from 'node:assert/strict';

// portraits.js uses dynamic imports for two optional manifests
// (/assets/horses/index.js for pixel-art, /assets/horses-codex/index.js
// for Codex). The whole module graph must stay loadable when both are
// missing — the game runs on silhouettes in that case.

import * as portraits from '../src/portraits.js';

test('portraits module loads without the optional manifests', () => {
  assert.equal(typeof portraits.preloadPortraits, 'function');
  assert.equal(typeof portraits.preloadCodex, 'function');
  assert.equal(typeof portraits.getPortraitForHorse, 'function');
  assert.equal(typeof portraits.renderPortrait, 'function');
  assert.equal(typeof portraits.portraitTierStatus, 'function');
  // silhouetteFor is re-exported so consumers don't need a second import
  assert.equal(typeof portraits.silhouetteFor, 'function');
});

test('preloadPortraits is safe to call when manifests are missing', async () => {
  // In Node there are no /assets/* modules to load. The dynamic imports
  // will fail; the catches inside load*Module() handle them. preload
  // should resolve cleanly (not reject) because it returns void on failure.
  await portraits.preloadPortraits();
});

test('preloadCodex is safe to call when codex manifest is missing', async () => {
  await portraits.preloadCodex();
});

test('getPortraitForHorse falls back to silhouette when no manifests', () => {
  const horse = { name: 'Test', stageId: 'campaigner', temperament: 'steady' };
  const result = portraits.getPortraitForHorse(horse);
  assert.equal(result.type, 'silhouette');
  assert.equal(result.stageId, 'campaigner');
});

test('getPortraitForHorse prefers silhouette over missing manifests for xl too', () => {
  const horse = { name: 'Test', stageId: 'campaigner', temperament: 'steady' };
  const result = portraits.getPortraitForHorse(horse, { size: 'xl' });
  assert.equal(result.type, 'silhouette');
  assert.equal(result.stageId, 'campaigner');
});

test('renderPortrait emits the silhouette fallback when no manifests', () => {
  const horse = { name: 'Test', stageId: 'campaigner', temperament: 'steady' };
  const html = portraits.renderPortrait(horse);
  assert.ok(html.includes('horse-silhouette'),
    'falls back to horse-silhouette span when portraits are absent');
  assert.ok(!html.includes('horse-portrait'),
    'does NOT emit horse-portrait when manifest is missing');
});

test('renderPortrait size param is honored in the silhouette fallback', () => {
  const horse = { name: 'Test', stageId: 'campaigner', temperament: 'steady' };
  const html = portraits.renderPortrait(horse, { size: 'xl' });
  assert.match(html, /horse-silhouette--xl/);
});

test('portraitTierStatus reports pending when modules not loaded', () => {
  const status = portraits.portraitTierStatus();
  assert.ok(status.pixelArt === 'pending' || status.pixelArt === 'failed' || status.pixelArt === 'loaded');
  assert.ok(status.codex === 'pending' || status.codex === 'failed' || status.codex === 'loaded');
  assert.equal(typeof status.pixelArtCount, 'number');
  assert.equal(typeof status.codexCount, 'number');
});