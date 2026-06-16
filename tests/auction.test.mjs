import test from 'node:test';
import assert from 'node:assert/strict';

import { runAuction, scoreHorseForBidder } from '../src/auction.js';
import { seedTraits } from '../src/horse.js';

test('a horse with elite traits scores higher than a horse with mediocre traits', () => {
  const elite = { traits: { gait_quality: 95, temperament_stability: 95, bone_density: 95, heart: 95, conformation: 95 } };
  const mediocre = { traits: { gait_quality: 30, temperament_stability: 30, bone_density: 30, heart: 30, conformation: 30 } };
  const bidder = { taste: { gait_quality: 0.9, temperament_stability: 0.5, bone_density: 0.5, heart: 0.5, conformation: 0.5 }, budget: 30000 };
  assert.ok(scoreHorseForBidder(elite, bidder) > scoreHorseForBidder(mediocre, bidder));
});

test('a bidder with a bigger budget pays more for the same horse', () => {
  const horse = { traits: seedTraits() };
  const small = { taste: { gait_quality: 0.5, temperament_stability: 0.5, bone_density: 0.5, heart: 0.5, conformation: 0.5 }, budget: 10000 };
  const big   = { ...small, budget: 60000 };
  assert.ok(scoreHorseForBidder(horse, big) > scoreHorseForBidder(horse, small));
});

test('runAuction returns top bid, runner-up, and full bid list', () => {
  const horse = { traits: seedTraits() };
  const result = runAuction(horse);
  assert.ok(result.topBid);
  assert.ok(result.runnerUp);
  assert.equal(result.allBids.length >= 3, true);
  assert.ok(result.topBid.offer >= result.runnerUp.offer);
});

test('top bid never exceeds the bidder budget', () => {
  const horse = { traits: { gait_quality: 100, temperament_stability: 100, bone_density: 100, heart: 100, conformation: 100 } };
  const result = runAuction(horse);
  assert.ok(result.topBid.offer <= result.topBid.budget);
});
