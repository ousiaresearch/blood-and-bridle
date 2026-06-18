import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BRAND_SET,
  DEFAULT_BRAND_ID,
  brandById,
  renderBrandGlyph,
  renderRanchProfile,
  renderLetterhead,
} from '../src/brand.js';
import { createNewGame, applyAction } from '../src/game.js';

test('BRAND_SET has 12 brands covering livestock-relevant glyphs', () => {
  assert.ok(BRAND_SET.length >= 12);
  for (const b of BRAND_SET) {
    assert.ok(b.id, 'brand has an id');
    assert.ok(b.symbol, 'brand has a symbol');
    assert.ok(b.label, 'brand has a label');
    assert.ok(b.hint, 'brand has a hint');
  }
});

test('DEFAULT_BRAND_ID is the canonical Blood & Bridle B-bar', () => {
  assert.equal(DEFAULT_BRAND_ID, 'bar-b');
});

test('bar-b brand carries the canonical image path', () => {
  const bar = brandById('bar-b');
  assert.equal(bar.imagePath, '/assets/brand/canonical.png');
});

test('non-canonical brands have no imagePath — they render as text glyphs', () => {
  for (const id of ['y-bar', 'diamond', 'cross', 'star']) {
    const b = brandById(id);
    assert.equal(b.imagePath, undefined, `${id} should have no imagePath`);
  }
});

test('brandById resolves known and unknown ids', () => {
  const ybar = brandById('y-bar');
  assert.equal(ybar.id, 'y-bar');
  const fallback = brandById('nope');
  assert.equal(fallback.id, DEFAULT_BRAND_ID);
});

test('renderBrandGlyph renders an <img> when the brand has imagePath', () => {
  const html = renderBrandGlyph('bar-b', 'extra');
  assert.match(html, /ranch-brand--image/);
  assert.match(html, /ranch-brand-image/);
  assert.match(html, /src="\/assets\/brand\/canonical\.png"/);
  assert.match(html, /data-brand="bar-b"/);
  assert.match(html, /class="ranch-brand ranch-brand--bar-b ranch-brand--image extra"/);
  assert.doesNotMatch(html, /B\u0304/, 'no raw glyph when image is shown');
});

test('renderBrandGlyph falls back to text glyph when brand has no image', () => {
  const html = renderBrandGlyph('diamond', 'extra');
  assert.match(html, /ranch-brand--glyph/);
  assert.match(html, /data-brand="diamond"/);
  assert.match(html, /class="ranch-brand ranch-brand--diamond ranch-brand--glyph extra"/);
  assert.doesNotMatch(html, /ranch-brand-image/);
  // The diamond glyph \u25C6 should be present in the output.
  assert.match(html, /\u25C6/);
});

test('renderRanchProfile renders the four required fields', () => {
  const game = createNewGame();
  const html = renderRanchProfile(game);
  assert.match(html, /name="ownerName"/);
  assert.match(html, /name="ownerPronouns"/);
  assert.match(html, /name="ranchName"/);
  assert.match(html, /data-form="ranch-profile"/);
});

test('renderRanchProfile renders all brand options', () => {
  const game = createNewGame();
  const html = renderRanchProfile(game);
  for (const b of BRAND_SET) {
    assert.match(html, new RegExp(`data-brand-id="${b.id}"`));
  }
});

test('renderRanchProfile renders an image for the canonical brand option', () => {
  const game = createNewGame();
  const html = renderRanchProfile(game);
  assert.match(html, /brand-option-image/);
  assert.match(html, /src="\/assets\/brand\/canonical\.png"/);
});

test('renderLetterhead renders the ranch name, brand, and founder info', () => {
  const game = { ranchBrand: 'diamond', ranchName: 'Cedar Draw', ownerName: 'J. Smith', foundedDay: 1 };
  const html = renderLetterhead(game);
  assert.match(html, /Cedar Draw/);
  assert.match(html, /ranch-brand--diamond/);
  assert.match(html, /J\. Smith/);
});

test('renderLetterhead uses the canonical image for bar-b', () => {
  const game = { ranchBrand: 'bar-b', ranchName: 'Hat Creek', ownerName: 'Bo', foundedDay: 1 };
  const html = renderLetterhead(game);
  assert.match(html, /letterhead-brand-image/);
  assert.match(html, /src="\/assets\/brand\/canonical\.png"/);
  assert.doesNotMatch(html, /ranch-brand--bar-b/);
});

test('renderLetterhead falls back to "Unbranded" for empty ranch names', () => {
  const game = { ranchBrand: 'y-bar', ranchName: '', ownerName: '', foundedDay: 1 };
  const html = renderLetterhead(game);
  assert.match(html, /Unbranded/);
});

test('updateRanchProfile action persists all four fields', () => {
  let game = createNewGame();
  game = applyAction(game, {
    type: 'updateRanchProfile',
    profile: { ownerName: 'Anduril', ownerPronouns: 'he/him', ranchName: 'Hat Creek', ranchBrand: 'diamond' },
  });
  assert.equal(game.ownerName, 'Anduril');
  assert.equal(game.ownerPronouns, 'he/him');
});