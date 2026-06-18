import test from 'node:test';
import assert from 'node:assert/strict';

// Brand surfaces: the Codex-generated close-ups of the brand on
// real ranch objects (gate, hay barn, heifer, jacket, salve, truck).
// Tested in isolation — no DOM, no assets on disk.

import {
  BRAND_SURFACES,
  BRAND_SCENES,
  renderBrandSurface,
  renderBrandScene,
  pickTitleCardSurface,
} from '../src/brand.js';

test('BRAND_SURFACES has the 10 phase-14 surfaces', () => {
  assert.equal(Object.keys(BRAND_SURFACES).length, 10);
  for (const key of [
    'titleCardDay', 'titleCardNight',
    'hayBarnDay', 'hayBarnEvening',
    'heiferBefore', 'heiferAfter',
    'jacket', 'salve', 'truckStill', 'truckMoving',
  ]) {
    assert.ok(BRAND_SURFACES[key], `${key} exists`);
    assert.match(BRAND_SURFACES[key].imagePath, /^\/assets\/brand\/surfaces\//);
  }
});

test('BRAND_SCENES has the 3 phase-14 scenes', () => {
  assert.equal(Object.keys(BRAND_SCENES).length, 3);
  for (const key of ['gate', 'brandingDay', 'loss']) {
    assert.ok(BRAND_SCENES[key], `${key} exists`);
    assert.match(BRAND_SCENES[key].imagePath, /^\/assets\/scenes\/brand\//);
  }
});

test('renderBrandSurface returns an <img> for known keys', () => {
  const html = renderBrandSurface('hayBarnDay');
  assert.match(html, /^<img /);
  assert.match(html, /src="\/assets\/brand\/surfaces\/hay_barn_brand\.png"/);
  assert.match(html, /data-brand-surface="hayBarnDay"/);
});

test('renderBrandSurface returns empty string for unknown keys', () => {
  assert.equal(renderBrandSurface('nonexistent'), '');
});

test('renderBrandSurface supports a className', () => {
  const html = renderBrandSurface('jacket', { className: 'letterhead-jacket' });
  assert.match(html, /class="brand-surface [^"]*letterhead-jacket"/);
});

test('renderBrandScene returns an <img> for known keys', () => {
  const html = renderBrandScene('gate');
  assert.match(html, /^<img /);
  assert.match(html, /src="\/assets\/scenes\/brand\/gate_scene\.png"/);
});

test('renderBrandScene returns empty string for unknown keys', () => {
  assert.equal(renderBrandScene('nonexistent'), '');
});

test('pickTitleCardSurface returns the day surface by default', () => {
  const surface = pickTitleCardSurface();
  assert.equal(surface.imagePath, BRAND_SURFACES.titleCardDay.imagePath);
});

test('pickTitleCardSurface returns the night surface when isNight', () => {
  const surface = pickTitleCardSurface({ isNight: true });
  assert.equal(surface.imagePath, BRAND_SURFACES.titleCardNight.imagePath);
});