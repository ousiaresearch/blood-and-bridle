import test from 'node:test';
import assert from 'node:assert/strict';

import { getSeason, getYear, getDayOfSeason, isSeasonBoundary, isYearBoundary, DAYS_PER_SEASON, SEASONS, getSeasonalCostMultiplier } from '../src/seasons.js';

function makeGame(day) { return { day }; }

test('day 1 is spring of year 1', () => {
  assert.equal(getSeason(makeGame(1)), 'Spring');
  assert.equal(getYear(makeGame(1)), 1);
  assert.equal(getDayOfSeason(makeGame(1)), 1);
});

test('day 31 begins summer', () => {
  assert.equal(getSeason(makeGame(31)), 'Summer');
  assert.equal(getDayOfSeason(makeGame(31)), 1);
});

test('day 61 begins fall', () => {
  assert.equal(getSeason(makeGame(61)), 'Fall');
});

test('day 91 begins winter', () => {
  assert.equal(getSeason(makeGame(91)), 'Winter');
});

test('day 121 begins spring of year 2', () => {
  assert.equal(getSeason(makeGame(121)), 'Spring');
  assert.equal(getYear(makeGame(121)), 2);
});

test('season boundary is true on day 31, 61, 91, 121, etc.', () => {
  assert.equal(isSeasonBoundary(makeGame(31)), true);
  assert.equal(isSeasonBoundary(makeGame(61)), true);
  assert.equal(isSeasonBoundary(makeGame(91)), true);
  assert.equal(isSeasonBoundary(makeGame(121)), true);
  assert.equal(isSeasonBoundary(makeGame(1)), false);
  assert.equal(isSeasonBoundary(makeGame(30)), false);
});

test('year boundary fires on day 121', () => {
  assert.equal(isYearBoundary(makeGame(121)), true);
  assert.equal(isYearBoundary(makeGame(241)), true);
  assert.equal(isYearBoundary(makeGame(31)), false);
  assert.equal(isYearBoundary(makeGame(91)), false);
});

test('winter has the highest seasonal cost multiplier', () => {
  const winter = getSeasonalCostMultiplier('Winter');
  const summer = getSeasonalCostMultiplier('Summer');
  assert.ok(winter > summer);
});

test('season cycle is exactly 4 seasons per year', () => {
  assert.equal(SEASONS.length * DAYS_PER_SEASON, 120);
});
