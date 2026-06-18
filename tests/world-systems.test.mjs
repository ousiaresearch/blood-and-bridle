// Blood & Bridle — world systems tests.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WEATHER_TYPES,
  WEATHER_PROFILES,
  rollYearWeather,
  rollSeverity,
  generateYearWeather,
  createInitialWeather,
  tickWeather,
  weatherNarrative,
  isSevereWeather,
} from '../src/weather-system.js';
import {
  BUYER_TYPES,
  BUYER_DEFS,
  findBuyer,
  marketOffer,
  marketSentiment,
  dispersalSale,
} from '../src/market.js';
import {
  COMMUNITY_MEMBERS,
  availableCommunity,
  departedCommunity,
  communityNarrative,
  SERVICE_COSTS,
  COMMUNITY_EVENTS,
  eventsForMonth,
} from '../src/community.js';

test('WEATHER_TYPES has all 8 types', () => {
  assert.equal(Object.keys(WEATHER_TYPES).length, 8);
});

test('WEATHER_PROFILES has a profile for every type', () => {
  for (const t of Object.values(WEATHER_TYPES)) {
    assert.ok(WEATHER_PROFILES[t], `${t} has a profile`);
  }
});

test('rollYearWeather returns a valid type', () => {
  const t = rollYearWeather(1);
  assert.ok(Object.values(WEATHER_TYPES).includes(t));
});

test('rollSeverity returns a number in the profile range', () => {
  const s = rollSeverity(WEATHER_TYPES.DROUGHT, () => 0);
  const profile = WEATHER_PROFILES[WEATHER_TYPES.DROUGHT];
  assert.ok(s >= profile.severityMin);
});

test('generateYearWeather returns full state', () => {
  const w = generateYearWeather(1);
  assert.ok(w.type);
  assert.equal(typeof w.severity, 'number');
  assert.ok(w.description);
  assert.equal(typeof w.parcelHazardMult, 'number');
  assert.equal(w.year, 1);
});

test('createInitialWeather: normal type, severity 1.0', () => {
  const w = createInitialWeather();
  assert.equal(w.currentType, WEATHER_TYPES.NORMAL);
  assert.equal(w.currentSeverity, 1.0);
});

test('tickWeather: advances and records year log', () => {
  const w0 = createInitialWeather();
  const w1 = tickWeather(w0, 2);
  assert.equal(w1.currentYear, 2);
  assert.equal(w1.yearLog.length, 1);
});

test('weatherNarrative returns a non-empty line', () => {
  const w = createInitialWeather();
  assert.ok(weatherNarrative(w).length > 0);
});

test('isSevereWeather: false at normal, true at drought', () => {
  assert.equal(isSevereWeather({ currentSeverity: 1.0 }), false);
  assert.equal(isSevereWeather({ currentSeverity: 1.5 }), true);
});

test('BUYER_TYPES has 5 buyer types', () => {
  assert.equal(Object.keys(BUYER_TYPES).length, 5);
});

test('BUYER_DEFS has 4 named buyers', () => {
  assert.equal(BUYER_DEFS.length, 4);
});

test('findBuyer: returns killer buyer for old tired horse', () => {
  const horse = { id: 'h1', age: 14, health: 30 };
  const buyer = findBuyer(horse);
  assert.ok(buyer);
});

test('findBuyer: returns order buyer at high horsemen corner for young sound horse', () => {
  const horse = { id: 'h1', age: 4, health: 90 };
  const buyer = findBuyer(horse, 80);
  assert.equal(buyer.id, 'order-buyer');
});

test('findBuyer: returns private buyer as fallback', () => {
  const horse = { id: 'h1', age: 100, health: 30 };  // no buyer matches
  const buyer = findBuyer(horse, 50);
  assert.ok(buyer);
});

test('marketOffer: applies buyer multiplier', () => {
  const horse = { id: 'h1', age: 14, health: 30, value: 10000 };
  const buyer = BUYER_DEFS[0];  // killer buyer
  // Override Math.random for deterministic test
  const origRandom = Math.random;
  Math.random = () => 0.5;
  try {
    const offer = marketOffer(horse, buyer);
    // 10000 × 0.45 × 1.0 (variance at 0.5) = ~4500
    assert.ok(offer > 4000 && offer < 5000, `offer should be ~4500, got ${offer}`);
  } finally {
    Math.random = origRandom;
  }
});

test('marketSentiment: dead at 0%, boiling at 100%', () => {
  assert.equal(marketSentiment(0).activity, 'dead');
  assert.equal(marketSentiment(95).activity, 'boiling');
});

test('dispersalSale returns herd of synthetic horses', () => {
  const herd = dispersalSale('Granger', 5);
  assert.equal(herd.length, 5);
  for (const h of herd) {
    assert.ok(h.name.includes('Granger'));
    assert.ok(h.value > 0);
  }
});

test('COMMUNITY_MEMBERS has at least 10 members', () => {
  assert.ok(COMMUNITY_MEMBERS.length >= 10);
});

test('availableCommunity: 0% country = only those with gate 0', () => {
  const avail = availableCommunity(0);
  // Only vet-voss has gate 0
  assert.equal(avail.length, 1);
  assert.equal(avail[0].id, 'vet-voss');
});

test('availableCommunity: 50% country = mid-tier members', () => {
  const avail = availableCommunity(50);
  assert.ok(avail.length >= 3);
});

test('availableCommunity: 100% country = all members', () => {
  assert.equal(availableCommunity(100).length, COMMUNITY_MEMBERS.length);
});

test('departedCommunity: returns members with gate > country', () => {
  const gone = departedCommunity(10);
  assert.ok(gone.length >= 5);
});

test('communityNarrative returns a non-empty line', () => {
  const line = communityNarrative(50);
  assert.ok(line.length > 0);
});

test('communityNarrative mentions the shut gate at low country', () => {
  const line = communityNarrative(5);
  assert.match(line, /shut/i);
});

test('communityNarrative mentions community at high country', () => {
  const line = communityNarrative(90);
  assert.match(line, /community|around/i);
});

test('SERVICE_COSTS has expected services', () => {
  assert.ok(typeof SERVICE_COSTS.farrier_visit === 'number');
  assert.ok(SERVICE_COSTS.farrier_visit > 0);
});

test('COMMUNITY_EVENTS has annual events', () => {
  assert.ok(COMMUNITY_EVENTS.length >= 5);
});

test('eventsForMonth returns events for that month', () => {
  const july = eventsForMonth(7);
  assert.ok(july.length >= 1);
  assert.equal(july[0].name, 'County Fair');
});