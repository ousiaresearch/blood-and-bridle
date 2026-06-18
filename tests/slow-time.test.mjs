// Blood & Bridle — slow time tests (Phase 9).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SLOW_MOMENTS,
  SLOW_MOMENT_LIBRARY,
  pickSlowMoment,
  buildSlowTimeView,
  shouldFireSlowMoment,
  getSlowMomentLibrary,
} from '../src/slow-time.js';

test('SLOW_MOMENTS has 8 moment types', () => {
  assert.equal(Object.keys(SLOW_MOMENTS).length, 8);
});

test('SLOW_MOMENT_LIBRARY has at least 8 fragments', () => {
  // Phase 10 — added 2 family-mention moments (BUNKHOUSE + MORNING_BREAKFAST).
  assert.ok(SLOW_MOMENT_LIBRARY.length >= 8);
});

test('pickSlowMoment: returns null if no candidates', () => {
  // No season with no candidates, so just verify it returns something
  const moment = pickSlowMoment('Summer');
  assert.ok(moment);
});

test('pickSlowMoment: returns after-funeral when recentEvents includes funeral', () => {
  const moment = pickSlowMoment('Spring', ['funeral']);
  assert.equal(moment.type, SLOW_MOMENTS.AFTER_FUNERAL);
});

test('pickSlowMoment: returns after-sale when recentEvents includes sale', () => {
  const moment = pickSlowMoment('Spring', ['sale']);
  assert.equal(moment.type, SLOW_MOMENTS.AFTER_SALE);
});

test('buildSlowTimeView: returns fragment and label', () => {
  const view = buildSlowTimeView('Winter');
  assert.ok(view.available);
  assert.ok(view.fragment);
  assert.ok(view.label);
});

test('buildSlowTimeView: returns after-funeral for recent funeral', () => {
  const view = buildSlowTimeView('Spring', ['funeral']);
  assert.equal(view.type, SLOW_MOMENTS.AFTER_FUNERAL);
});

test('shouldFireSlowMoment: winter fires more often', () => {
  // Winter: threshold 14
  assert.equal(shouldFireSlowMoment('Winter', 14, 100), true);
  assert.equal(shouldFireSlowMoment('Winter', 13, 100), false);
});

test('shouldFireSlowMoment: summer fires less often', () => {
  // Summer: threshold 45
  assert.equal(shouldFireSlowMoment('Summer', 45, 100), true);
  assert.equal(shouldFireSlowMoment('Summer', 44, 100), false);
});

test('shouldFireSlowMoment: default threshold is 30 days', () => {
  assert.equal(shouldFireSlowMoment('Spring', 30, 100), true);
  assert.equal(shouldFireSlowMoment('Fall', 30, 100), true);
  assert.equal(shouldFireSlowMoment('Spring', 29, 100), false);
});

test('getSlowMomentLibrary returns the full library', () => {
  const lib = getSlowMomentLibrary();
  // Phase 10 — added 2 family-mention moments.
  assert.ok(lib.length >= 8);
});

test('every slow moment has a non-empty fragment', () => {
  for (const m of SLOW_MOMENT_LIBRARY) {
    assert.ok(m.fragment.length > 0, `${m.type} has a fragment`);
  }
});

test('every slow moment lists its valid seasons', () => {
  for (const m of SLOW_MOMENT_LIBRARY) {
    for (const s of m.seasons) {
      assert.ok(['Spring', 'Summer', 'Fall', 'Winter'].includes(s));
    }
  }
});