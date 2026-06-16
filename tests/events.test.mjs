import test from 'node:test';
import assert from 'node:assert/strict';

import { tickEvents, resolveEvent, EVENTS } from '../src/events.js';
import { NPCS, recordNpcMemory } from '../src/npcs.js';
import { makeGame } from './helpers.js';

test('no event fires on day 5 (no season boundary)', () => {
  const game = makeGame({ day: 5 });
  const next = tickEvents(game);
  assert.equal(next.pendingEvent, null);
});

test('refusing the developer twice in a row queues a second-offer event', () => {
  NPCS['dev-coleman'].memory.refused = 0;
  let game = makeGame({ day: 61, firedEvents: [] });
  recordNpcMemory(game, 'dev-coleman', 'refused', 2);
  const next = tickEvents(game);
  assert.ok(next.pendingEvent);
  assert.equal(next.pendingEvent.id, 'dev-second-offer');
});

test('cordell trade offer fires after helping the neighbor', () => {
  NPCS['ranch-cordell'].memory.helped = 0;
  NPCS['dev-coleman'].memory.refused = 0; // prevent dev-second-offer from stealing the slot
  let game = makeGame({ day: 61, firedEvents: [] });
  recordNpcMemory(game, 'ranch-cordell', 'helped', 1);
  const next = tickEvents(game);
  assert.ok(next.pendingEvent);
  assert.equal(next.pendingEvent.id, 'cordell-trade-offer');
});

test('resolving an event applies its effect and clears pending', () => {
  NPCS['dev-coleman'].memory.refused = 0;
  let game = makeGame({ day: 61, cash: 5000, legacy: 60, developerPressure: 50 });
  recordNpcMemory(game, 'dev-coleman', 'refused', 1);
  game = tickEvents(game);
  assert.ok(game.pendingEvent);
  const after = resolveEvent(game, 0); // sign option
  assert.equal(after.pendingEvent, null);
  assert.equal(after.cash, 55000);
  assert.equal(after.legacy, 35);
});

test('banker warning fires when cash drops below 2400 in summer', () => {
  let game = makeGame({ day: 31, cash: 1000, firedEvents: [] });
  const next = tickEvents(game);
  assert.ok(next.pendingEvent);
  assert.equal(next.pendingEvent.id, 'banker-warning');
});

test('events only fire once', () => {
  NPCS['dev-coleman'].memory.refused = 0;
  let game = makeGame({ day: 61, firedEvents: [] });
  recordNpcMemory(game, 'dev-coleman', 'refused', 1);
  const first = tickEvents(game);
  const fired = resolveEvent(first, 1).firedEvents;
  const second = tickEvents({ ...first, pendingEvent: null, firedEvents: fired, day: 62 });
  assert.equal(second.pendingEvent, null);
});
