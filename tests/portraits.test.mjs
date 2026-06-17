import test from 'node:test';
import assert from 'node:assert/strict';

// portraits.js uses a dynamic import for the optional manifest. The whole
// module graph must stay loadable when /assets/horses/index.js is missing —
// the game runs on silhouettes in that case.

import * as portraits from '../src/portraits.js';

test('portraits module loads without the optional manifest', () => {
  assert.equal(typeof portraits.preloadPortraits, 'function');
  assert.equal(typeof portraits.getPortraitForHorse, 'function');
  assert.equal(typeof portraits.renderPortrait, 'function');
  // silhouetteFor is re-exported so consumers don't need a second import
  assert.equal(typeof portraits.silhouetteFor, 'function');
});

test('preloadPortraits is safe to call when manifest is missing', async () => {
  // In Node there is no /assets/horses/index.js to load. The dynamic
  // import will fail; the catch inside loadPortraitsModule() handles it.
  // preloadPortraits should resolve cleanly (not reject) because it
  // returns void on failure.
  await portraits.preloadPortraits();
});

test('getPortraitForHorse falls back to silhouette when no manifest', () => {
  // Build a minimal horse object — just the fields getPortraitForHorse
  // and renderPortrait actually read.
  const horse = { name: 'Test', stageId: 'campaigner', temperament: 'steady' };
  const result = portraits.getPortraitForHorse(horse);
  assert.equal(result.type, 'silhouette');
  assert.equal(result.stageId, 'campaigner');
});

test('renderPortrait emits the silhouette fallback when no manifest', () => {
  const horse = { name: 'Test', stageId: 'campaigner', temperament: 'steady' };
  const html = portraits.renderPortrait(horse);
  assert.ok(html.includes('horse-silhouette'),
    'falls back to horse-silhouette span when portraits are absent');
  assert.ok(!html.includes('horse-portrait'),
    'does NOT emit horse-portrait when manifest is missing');
});
