import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SHOWS,
  SHOW_CATEGORIES,
  showDay,
  getUpcomingShow,
  getShowCalendar,
  getShowOnDay,
  categoryMatch,
  scoreHorse,
  generateField,
  runShowdown,
  canEnterShow,
  getShowPrestigeLabel,
} from '../src/shows.js';
import { createNewGame, applyAction } from '../src/game.js';
import { makeGame } from './helpers.js';

test('SHOWS calendar has exactly 20 shows (4 per year × 5 years)', () => {
  assert.equal(SHOWS.length, 20);
});

test('every show has a unique id', () => {
  const ids = new Set(SHOWS.map((s) => s.id));
  assert.equal(ids.size, SHOWS.length);
});

test('every show has a valid season and category', () => {
  for (const show of SHOWS) {
    assert.ok(['Spring', 'Summer', 'Fall', 'Winter'].includes(show.season));
    assert.ok(SHOW_CATEGORIES[show.category]);
  }
});

test('showDay computes the correct absolute in-game day', () => {
  const game = createNewGame();
  // Year 1 Spring day 14
  assert.equal(showDay(game, 1, 'Spring', 14), 14);
  // Year 1 Summer day 14
  assert.equal(showDay(game, 1, 'Summer', 14), 44);
  // Year 2 Spring day 14
  assert.equal(showDay(game, 2, 'Spring', 14), 134);
});

test('getUpcomingShow returns the first show on or after the current day', () => {
  const game = makeGame({ day: 1 });
  const show = getUpcomingShow(game);
  assert.equal(show.id, 'spring-classic-1');
});

test('getShowCalendar marks past/today/upcoming correctly', () => {
  const game = makeGame({ day: 14 });
  const cal = getShowCalendar(game);
  const todayShow = cal.find((s) => s.id === 'spring-classic-1');
  assert.equal(todayShow.status, 'today');
});

test('getShowOnDay returns the show on that exact day', () => {
  const game = makeGame({ day: 14 });
  const show = getShowOnDay(game, 14);
  assert.equal(show.id, 'spring-classic-1');
  assert.equal(getShowOnDay(game, 13), null);
});

test('categoryMatch returns 1.0 for an exact role match', () => {
  const horse = { role: 'Reining mare' };
  assert.equal(categoryMatch(horse, 'reining'), 1.0);
});

test('categoryMatch returns 0 for a wrong category', () => {
  const horse = { role: 'Reining mare' };
  assert.equal(categoryMatch(horse, 'futurity'), 0);
});

test('scoreHorse returns 0 for horses that cannot compete', () => {
  const horse = { training: 90, bond: 90, health: 90, stress: 10, role: 'Reining mare', age: 1 };
  assert.equal(scoreHorse(horse, { category: 'reining' }), 0);
});

test('scoreHorse rewards high training, bond, health and penalizes stress', () => {
  const elite = { training: 90, bond: 90, health: 90, stress: 10, role: 'Reining mare', age: 6 };
  const bad   = { training: 30, bond: 30, health: 30, stress: 80, role: 'Reining mare', age: 6 };
  const show = { category: 'reining' };
  assert.ok(scoreHorse(elite, show) > scoreHorse(bad, show));
});

test('scoreHorse benefits from arena upgrades', () => {
  const horse = { training: 80, bond: 80, health: 80, stress: 20, role: 'Reining mare', age: 6 };
  const show = { category: 'reining' };
  const noArena = scoreHorse(horse, show, { arena: 0 });
  const withArena = scoreHorse(horse, show, { arena: 3 });
  assert.ok(withArena > noArena);
});

test('scoreHorse is reduced when the category is wrong', () => {
  const horse = { training: 90, bond: 90, health: 90, stress: 10, role: 'Reining mare', age: 6 };
  const reining = { category: 'reining' };
  const futurity = { category: 'futurity' };
  assert.ok(scoreHorse(horse, reining) > scoreHorse(horse, futurity));
});

test('generateField returns N competitors with scores in expected range', () => {
  const show = { prestige: 2 };
  const field = generateField(show, {}, () => 0.5);
  assert.equal(field.length >= 6, true);
  for (const c of field) assert.ok(c.score > 0);
  // Sorted descending
  for (let i = 1; i < field.length; i++) assert.ok(field[i - 1].score >= field[i].score);
});

test('runShowdown with elite horse returns a champion result', () => {
  const elite = { training: 95, bond: 95, health: 95, stress: 5, role: 'Reining mare', age: 6, name: 'Test' };
  const show = SHOWS[0];
  const result = runShowdown(elite, show, {}, () => 0.3);
  assert.equal(result.result, 'champion');
  assert.equal(result.playerPlace, 1);
  assert.equal(result.payout, show.prizePool);
  assert.ok(result.reputationDelta > 0);
});

test('runShowdown with bad horse returns an also-ran result', () => {
  const bad = { training: 20, bond: 20, health: 30, stress: 80, role: 'Reining mare', age: 6, name: 'Bad' };
  const show = SHOWS[0];
  const result = runShowdown(bad, show, {}, () => 0.9);
  assert.equal(result.result, 'also-ran');
  assert.equal(result.payout, 0);
  assert.ok(result.reputationDelta < 0);
});

test('canEnterShow rejects a foal', () => {
  const foal = { name: 'Foal', role: 'Prospect filly', age: 0, stress: 20 };
  const show = SHOWS[0];
  const result = canEnterShow(foal, show);
  assert.equal(result.ok, false);
});

test('canEnterShow rejects a wrong-category entry', () => {
  const horse = { name: 'Wrong', role: 'Reining mare', age: 6, stress: 20 };
  const fut = { category: 'futurity' };
  const result = canEnterShow(horse, fut);
  assert.equal(result.ok, false);
});

test('canEnterShow accepts a fitting campaigner with low stress', () => {
  const horse = { name: 'Good', role: 'Reining mare', age: 6, stress: 20 };
  const show = { category: 'reining' };
  assert.equal(canEnterShow(horse, show).ok, true);
});

test('getShowPrestigeLabel categorizes shows correctly', () => {
  assert.equal(getShowPrestigeLabel(1), 'Local');
  assert.equal(getShowPrestigeLabel(2), 'Regional');
  assert.equal(getShowPrestigeLabel(3), 'Major');
});
