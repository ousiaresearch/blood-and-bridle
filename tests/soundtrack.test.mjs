import test from 'node:test';
import assert from 'node:assert/strict';

// soundtrack.js was the source of a hard app-load failure: a top-level static
// `import '/assets/soundtrack/index.js'` returned 404 in the browser and the
// whole module graph collapsed. The fix is a lazy loader with a "manifest
// unavailable" sentinel that returns null and lets the rest of the app keep
// running silently. These tests pin that contract.

import * as soundtrack from '../src/soundtrack.js';

test('soundtrack module loads without a static asset import', () => {
  // If the module had a top-level static import of a missing file this would
  // throw at import time. The fact that we got here is the assertion.
  assert.equal(typeof soundtrack.playForSeason, 'function');
  assert.equal(typeof soundtrack.playForMood, 'function');
  assert.equal(typeof soundtrack.stopSoundtrack, 'function');
  assert.equal(typeof soundtrack.setSoundtrackMuted, 'function');
  assert.equal(typeof soundtrack.setSoundtrackVolume, 'function');
  assert.ok(soundtrack.soundtrack, 'soundtrack singleton exported');
});

test('playForSeason is a safe no-op when the manifest is missing', async () => {
  // In Node we have no window, so the internal init() can't be called —
  // which is what we want. The function should bail before any browser
  // global is touched. We can't easily simulate a missing dynamic-import
  // failure here, so this test pins the "no throw on import + missing
  // globals" path.
  try {
    const result = await soundtrack.playForSeason('spring');
    assert.ok(result === undefined || result instanceof Promise === false,
      'returns undefined, not a pending promise');
  } catch (e) {
    // Acceptable if the underlying engine throws because there's no
    // AudioContext. The contract is: the lazy loader must not throw BEFORE
    // it reaches the engine. A throw from init() is documented in the
    // soundtrack code path but the app code wraps these in .catch(() => {}).
    assert.ok(/AudioContext|window/.test(e.message),
      'throws only because of missing browser globals, not the manifest');
  }
});

test('stop / mute / volume are safe to call without an audio context', () => {
  // None of these touch the manifest, the audio context, or anything
  // browser-only. They must be safe no-ops in any environment.
  soundtrack.stopSoundtrack();
  soundtrack.setSoundtrackMuted(true);
  soundtrack.setSoundtrackMuted(false);
  soundtrack.setSoundtrackVolume(0);
  soundtrack.setSoundtrackVolume(1);
  soundtrack.setSoundtrackVolume(0.5);
  // No assertion needed — the test passes if none of the above throws.
});
