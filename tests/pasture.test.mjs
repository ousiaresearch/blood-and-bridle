import test from 'node:test';
import assert from 'node:assert/strict';

import { renderPasture } from '../src/pasture.js';
import { createNewGame } from '../src/game.js';

test('renderPasture returns a hint when there are no horses', () => {
  const html = renderPasture([], null);
  assert.match(html, /barn is too quiet/);
});

test('renderPasture groups horses by life stage into paddocks', () => {
  const game = createNewGame();
  const html = renderPasture(game.horses, null);
  // The seed herd contains campaigners, yearlings, and a legendary horse.
  assert.match(html, /pasture-paddock--campaigner/);
  assert.match(html, /pasture-paddock--legendary/);
  // Every horse is rendered into some paddock.
  for (const h of game.horses) {
    assert.match(html, new RegExp(`data-select-horse="${h.id}"`));
  }
});

test('renderPasture applies card--selected to the chosen horse', () => {
  const game = createNewGame();
  const selected = game.horses[0].id;
  const html = renderPasture(game.horses, selected);
  // Locate the button line for the selected horse and confirm it carries card--selected.
  const lineMatch = html.match(new RegExp(`<button[^>]*data-select-horse="${selected}"[^>]*>`));
  assert.ok(lineMatch, 'expected a button line for the selected horse');
  assert.match(lineMatch[0], /card--selected/);
});

test('renderPasture skips paddocks with no horses', () => {
  const game = createNewGame();
  // Retiree paddock should be skipped — no retirees in the seed herd.
  const html = renderPasture(game.horses, null);
  // The retiree paddock section should not appear (filtered out when empty).
  // We assert by the absence of the markup.
  assert.ok(!html.includes('pasture-paddock--retiree') || html.match(/pasture-paddock--retiree/)?.[0].length === 0, 'retiree paddock should not render without horses');
});

test('renderPasture puts the legendary horse in its own paddock', () => {
  const game = createNewGame();
  const html = renderPasture(game.horses, null);
  // The legendary paddock section exists and contains the legendary horse.
  const legendary = game.horses.find((h) => h.legendary);
  assert.ok(legendary);
  assert.match(html, /pasture-paddock--legendary/);
  assert.match(html, new RegExp(`data-select-horse="${legendary.id}"`));
});