import test from 'node:test';
import assert from 'node:assert/strict';

// Kitchen table modal: renders the scene's speakers, line bubbles,
// setup stage direction, and choice buttons.

import { renderKitchenTable, openKitchenTable } from '../src/kitchen-table.js';
import { sceneById } from '../src/scenes.js';

test('renderKitchenTable returns HTML for a known scene', () => {
  const scene = sceneById('skip-farrier');
  const game = {
    hands: [
      { id: 'mae', morale: 60 },
      { id: 'eli', morale: 60 },
      { id: 'elena', morale: 60 },
    ],
  };
  const html = renderKitchenTable(scene, game);
  assert.match(html, /data-scene="skip-farrier"/);
  assert.match(html, /kt-speaker--mae/);
  assert.match(html, /kt-speaker--eli/);
  assert.match(html, /kt-speaker--elena/);
  assert.match(html, /Coffee on the stove/); // setup line
  assert.match(html, /data-choice="pay"/);
  assert.match(html, /data-choice="skip"/);
  assert.match(html, /data-choice="half"/);
});

test('renderKitchenTable filters silent hands', () => {
  const scene = sceneById('skip-farrier');
  const game = {
    hands: [
      { id: 'mae', morale: 5 },     // silent
      { id: 'elena', morale: 60 },  // speaks
    ],
  };
  const html = renderKitchenTable(scene, game);
  assert.doesNotMatch(html, /kt-speaker--mae/);
  assert.match(html, /kt-speaker--elena/);
});

test('renderKitchenTable shows "Nobody speaks" when all hands silent', () => {
  const scene = sceneById('skip-farrier');
  const game = {
    hands: [
      { id: 'mae', morale: 5 },
      { id: 'eli', morale: 5 },
      { id: 'elena', morale: 5 },
    ],
  };
  const html = renderKitchenTable(scene, game);
  assert.match(html, /Nobody speaks/);
});

test('renderKitchenTable includes background image when present', () => {
  const scene = sceneById('skip-farrier');
  const html = renderKitchenTable(scene, { hands: [] });
  assert.match(html, /bunkhouse_spring\.png/);
});

test('renderKitchenTable falls back to placeholder background', () => {
  const fakeScene = {
    id: 'no-bg',
    label: 'Test',
    setup: 'No bg here.',
    speakers: [],
    choices: [{ id: 'ok', label: 'OK', effects: {} }],
    background: null,
  };
  const html = renderKitchenTable(fakeScene, { hands: [] });
  assert.match(html, /kt-background--placeholder/);
});

test('renderKitchenTable handles missing hands array', () => {
  const scene = sceneById('skip-farrier');
  const html = renderKitchenTable(scene, {}); // no hands
  assert.match(html, /Nobody speaks/);
});

test('openKitchenTable returns null for null scene', () => {
  const result = openKitchenTable(null, { hands: [] }, () => {});
  assert.equal(result, null);
});