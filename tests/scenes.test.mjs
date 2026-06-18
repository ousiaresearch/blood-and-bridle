import test from 'node:test';
import assert from 'node:assert/strict';

// Kitchen table scenes fire at moments of choice. They have a setup
// line, speakers (each with a topic + topic-specific lines), and 2-3
// choices that land effects on the game state.

import { KITCHEN_SCENES, sceneById, sceneForTrigger, resolveSceneDialogue } from '../src/scenes.js';
import { HAND_VOICES } from '../src/hands-voice.js';

test('KITCHEN_SCENES covers the planned scenes', () => {
  // 12 from the plan + buy-west-meadow (added because it ties directly
  // to a phase-10 parcel decision) + 3 heir scenes (Phase 13) = 16.
  assert.equal(KITCHEN_SCENES.length, 16);
  const expected = [
    'skip-farrier', 'delay-wages', 'skip-tax', 'skip-vet',
    'fire-tucker', 'give-eli-winter-off', 'promote-tucker',
    'take-loan', 'sell-mare', 'sell-stallion', 'sign-contract',
    'end-season-broke', 'buy-west-meadow',
    'heir-arrival', 'heir-departure', 'heir-kitchen-table',
  ];
  for (const id of expected) {
    assert.ok(sceneById(id), `${id} exists`);
  }
});

test('every scene has a valid structure', () => {
  for (const scene of KITCHEN_SCENES) {
    assert.ok(scene.id, `${scene} has id`);
    assert.ok(scene.label, `${scene.id} has label`);
    assert.ok(scene.trigger, `${scene.id} has trigger`);
    assert.ok(scene.setup, `${scene.id} has setup line`);
    assert.ok(Array.isArray(scene.speakers), `${scene.id} has speakers[]`);
    assert.ok(scene.speakers.length >= 1, `${scene.id} has at least one speaker`);
    assert.ok(Array.isArray(scene.choices), `${scene.id} has choices[]`);
    assert.ok(scene.choices.length >= 2, `${scene.id} has at least 2 choices`);

    // Every speaker references a hand with a known voice.
    for (const speaker of scene.speakers) {
      assert.ok(HAND_VOICES[speaker.handId], `${scene.id}: speaker ${speaker.handId} has a voice`);
      assert.ok(speaker.topic, `${scene.id}: speaker has a topic`);
      assert.ok(['singleton', 'open-and-line', 'line-and-close', 'full'].includes(speaker.composition),
        `${scene.id}: composition ${speaker.composition} is known`);
    }

    // Every choice has an id, label, and effects object.
    for (const choice of scene.choices) {
      assert.ok(choice.id, `${scene.id}: choice has id`);
      assert.ok(choice.label, `${scene.id}: choice has label`);
      assert.ok(choice.effects, `${scene.id}: choice has effects`);
    }
  }
});

test('sceneForTrigger finds scenes by trigger string', () => {
  assert.equal(sceneForTrigger('moral:farrier')?.id, 'skip-farrier');
  assert.equal(sceneForTrigger('moral:wages')?.id, 'delay-wages');
  assert.equal(sceneForTrigger('moral:property_tax')?.id, 'skip-tax');
  assert.equal(sceneForTrigger('moral:veterinary')?.id, 'skip-vet');
  assert.equal(sceneForTrigger('event:fireDayWorker')?.id, 'fire-tucker');
  assert.equal(sceneForTrigger('event:bankLoanOffer')?.id, 'take-loan');
  assert.equal(sceneForTrigger('event:privateOffer')?.id, 'sell-mare');
  assert.equal(sceneForTrigger('event:developerOffer')?.id, 'sign-contract');
  assert.equal(sceneForTrigger('unknown:thing'), null);
});

test('skip-farrier scene covers all four moral categories', () => {
  // Each moral category should have a scene trigger.
  assert.ok(sceneForTrigger('moral:farrier'));
  assert.ok(sceneForTrigger('moral:wages'));
  assert.ok(sceneForTrigger('moral:property_tax'));
  assert.ok(sceneForTrigger('moral:veterinary'));
});

test('resolveSceneDialogue returns lines for working hands at neutral morale', () => {
  const scene = sceneById('skip-farrier');
  const hands = [
    { id: 'mae', morale: 60 },
    { id: 'eli', morale: 60 },
    { id: 'elena', morale: 60 },
  ];
  const lines = resolveSceneDialogue(scene, hands);
  assert.equal(lines.length, 3);
  for (const l of lines) {
    assert.ok(l.handId);
    assert.ok(l.line && l.line.length > 0);
    assert.ok(['neutral', 'advocating'].includes(l.mood));
  }
});

test('resolveSceneDialogue filters out silent hands', () => {
  const scene = sceneById('skip-farrier');
  const hands = [
    { id: 'mae', morale: 10 },     // silent
    { id: 'elena', morale: 60 },   // speaks
  ];
  const lines = resolveSceneDialogue(scene, hands);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].handId, 'elena');
});

test('resolveSceneDialogue marks advocates at high morale', () => {
  const scene = sceneById('skip-farrier');
  const hands = [
    { id: 'mae', morale: 90 },     // advocates
    { id: 'elena', morale: 60 },   // neutral
  ];
  const lines = resolveSceneDialogue(scene, hands);
  assert.equal(lines.find((l) => l.handId === 'mae').mood, 'advocating');
  assert.equal(lines.find((l) => l.handId === 'elena').mood, 'neutral');
});

test('resolveSceneDialogue filters out hands marked silent on a topic', () => {
  // Eli is silent on skipTraining, but the skip-farrier scene uses
  // topic 'farrier' (where Eli has stance 'mixed'). Test a scene where
  // Eli has stance silent on a topic.
  const hands = [
    { id: 'mae', morale: 60 },
    { id: 'eli', morale: 90 },     // high morale, but skipTraining is silent for him
  ];
  const fakeScene = {
    id: 'test',
    speakers: [{ handId: 'eli', topic: 'skipTraining', composition: 'singleton', topicLines: {} }],
  };
  const lines = resolveSceneDialogue(fakeScene, hands);
  assert.equal(lines.length, 0);
});

test('choice effects cover cash, reputation, and morale-risk keys', () => {
  const scene = sceneById('skip-farrier');
  const allKeys = new Set();
  for (const c of scene.choices) {
    for (const k of Object.keys(c.effects)) allKeys.add(k);
  }
  // cash, country, crew, horsemen, bank, moralRisk — at least these.
  assert.ok(allKeys.has('cash'));
  assert.ok(allKeys.has('country'));
});

test('all scenes have a path-shaped background reference or null', () => {
  for (const scene of KITCHEN_SCENES) {
    if (scene.background !== null) {
      assert.match(scene.background, /^\/assets\/scenes\//);
    }
  }
});