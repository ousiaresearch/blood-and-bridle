import test from 'node:test';
import assert from 'node:assert/strict';

import { NPCS, recordNpcMemory, adjustRelationship, adjustPatience } from '../src/npcs.js';
import { makeGame } from './helpers.js';

test('recordNpcMemory increments memory key', () => {
  const before = NPCS['dev-coleman'].memory.refused ?? 0;
  recordNpcMemory(makeGame(), 'dev-coleman', 'refused', 1);
  assert.equal(NPCS['dev-coleman'].memory.refused, before + 1);
});

test('recordNpcMemory on unknown NPC is a no-op', () => {
  const before = Object.keys(NPCS).length;
  recordNpcMemory(makeGame(), 'ghost', 'x', 1);
  assert.equal(Object.keys(NPCS).length, before);
});

test('adjustRelationship clamps to -100..100', () => {
  adjustRelationship('dev-coleman', 200);
  assert.equal(NPCS['dev-coleman'].relationship, 100);
  adjustRelationship('dev-coleman', -300);
  assert.equal(NPCS['dev-coleman'].relationship, -100);
});

test('adjustPatience clamps to 0..100', () => {
  adjustPatience('dev-coleman', -300);
  assert.equal(NPCS['dev-coleman'].patience, 0);
  adjustPatience('dev-coleman', 300);
  assert.equal(NPCS['dev-coleman'].patience, 100);
});
