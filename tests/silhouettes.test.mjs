import test from 'node:test';
import assert from 'node:assert/strict';

import { silhouetteFor, ribbonFor } from '../src/silhouettes.js';

test('silhouetteFor returns a silhouette for every documented life stage', () => {
  const stages = ['foal', 'yearling', 'prospect', 'campaigner', 'retiree', 'dead'];
  for (const stage of stages) {
    const s = silhouetteFor(stage);
    assert.ok(s, `missing silhouette for ${stage}`);
    assert.ok(s.startsWith('data:image/svg+xml'), `${stage} is not a data URL`);
    assert.ok(s.includes('viewBox'), `${stage} has no viewBox`);
  }
});

test('silhouetteFor falls back to campaigner on unknown stage', () => {
  const s = silhouetteFor('not-a-real-stage');
  assert.ok(s);
  assert.ok(s.startsWith('data:image/svg+xml'));
});

test('silhouetteFor handles null/undefined gracefully', () => {
  assert.ok(silhouetteFor(null));
  assert.ok(silhouetteFor(undefined));
});

test('ribbonFor maps hot temperament to hot ribbon', () => {
  assert.equal(ribbonFor('hot, brilliant, not yet convinced humans matter'), 'hot');
  assert.equal(ribbonFor('dominant, protective'), 'hot');
  assert.equal(ribbonFor('explosive in the turn'), 'hot');
});

test('ribbonFor maps cool temperament to cool ribbon', () => {
  assert.equal(ribbonFor('suspicious of strangers'), 'cool');
  assert.equal(ribbonFor('curious, clever, too smart for sloppy hands'), 'cool');
});

test('ribbonFor maps warm temperament to warm ribbon', () => {
  assert.equal(ribbonFor('steady, forgiving'), 'warm');
  assert.equal(ribbonFor('storm-nervous, handler-loyal'), 'warm');
});

test('ribbonFor falls back to warm on null/undefined', () => {
  assert.equal(ribbonFor(null), 'warm');
  assert.equal(ribbonFor(undefined), 'warm');
  assert.equal(ribbonFor(''), 'warm');
});
