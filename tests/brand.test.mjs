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

test('DEFAULT_BRAND_ID is the classic Y-bar', () => {
  assert.equal(DEFAULT_BRAND_ID, 'y-bar');
});

test('brandById resolves known and unknown ids', () => {
  const ybar = brandById('y-bar');
  assert.equal(ybar.id, 'y-bar');
  const fallback = brandById('nope');
  assert.equal(fallback.id, DEFAULT_BRAND_ID);
});

test('renderBrandGlyph returns an inline stamp span with the brand id', () => {
  const html = renderBrandGlyph('diamond', 'extra');
  assert.match(html, /ranch-brand/);
  assert.match(html, /data-brand="diamond"/);
  assert.match(html, /class="ranch-brand ranch-brand--diamond extra"/);
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

test('renderLetterhead renders the ranch name, brand glyph, and founder info', () => {
  const game = { ranchBrand: 'diamond', ranchName: 'Cedar Draw', ownerName: 'J. Smith', foundedDay: 1 };
  const html = renderLetterhead(game);
  assert.match(html, /Cedar Draw/);
  assert.match(html, /ranch-brand--diamond/);
  assert.match(html, /J\. Smith/);
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
  assert.equal(game.ranchName, 'Hat Creek');
  assert.equal(game.ranchBrand, 'diamond');
});

test('updateRanchProfile action truncates overly long inputs', () => {
  let game = createNewGame();
  const longName = 'X'.repeat(100);
  game = applyAction(game, {
    type: 'updateRanchProfile',
    profile: { ownerName: longName, ranchName: longName },
  });
  assert.ok(game.ownerName.length <= 48);
  assert.ok(game.ranchName.length <= 48);
});

test('updateRanchProfile logs a stamp event', () => {
  let game = createNewGame();
  game = applyAction(game, {
    type: 'updateRanchProfile',
    profile: { ranchName: 'Hat Creek' },
  });
  assert.match(game.log[0], /Stamped the brand/);
});