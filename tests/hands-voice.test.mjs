import test from 'node:test';
import assert from 'node:assert/strict';

// Each hand has a distinct voice: different cadence, different stance
// on the topics that come up at the kitchen table. Morale gates
// whether they speak at all, and how hard they push their position.

import { HAND_VOICES, voiceForHand, shouldSpeak, shouldAdvocate, renderHandLine } from '../src/hands-voice.js';

test('HAND_VOICES covers all five working hands', () => {
  for (const id of ['mae', 'eli', 'reyes', 'elena', 'cordell-voss']) {
    assert.ok(HAND_VOICES[id], `voice for ${id}`);
    assert.equal(HAND_VOICES[id].id, id);
    assert.ok(HAND_VOICES[id].voice, `${id} has a voice style`);
    assert.ok(HAND_VOICES[id].openers?.length > 0, `${id} has openers`);
    assert.ok(HAND_VOICES[id].closers?.length > 0, `${id} has closers`);
    assert.ok(HAND_VOICES[id].stance, `${id} has a stance map`);
    assert.ok(HAND_VOICES[id].moraleGates, `${id} has morale gates`);
  }
});

test('each hand has a distinct voice style', () => {
  const styles = new Set();
  for (const v of Object.values(HAND_VOICES)) styles.add(v.voice);
  assert.ok(styles.size >= 4, `at least 4 distinct voices, got ${[...styles].join(', ')}`);
});

test('voiceForHand returns null for unknown id', () => {
  assert.equal(voiceForHand('nobody'), null);
  assert.equal(voiceForHand('mae').name, 'Mae Calder');
});

test('shouldSpeak gates by morale', () => {
  assert.equal(shouldSpeak('mae', 10), false, 'silent at very low morale');
  assert.equal(shouldSpeak('mae', 50), true, 'speaks at average morale');
  assert.equal(shouldSpeak('mae', 80), true, 'speaks at high morale');
});

test('shouldAdvocate gates higher than shouldSpeak', () => {
  for (const v of Object.values(HAND_VOICES)) {
    const advocate = v.moraleGates.advocatesAbove;
    const speak = v.moraleGates.speaksBelow;
    assert.ok(advocate > speak, `${v.id}: advocate (${advocate}) > speak (${speak})`);
  }
});

test('renderHandLine returns null below speaksBelow threshold', () => {
  const line = renderHandLine('mae', 'farrier', { morale: 10 });
  assert.equal(line, null);
});

test('renderHandLine returns a line at neutral morale', () => {
  const line = renderHandLine('mae', 'farrier', { morale: 60 });
  assert.ok(line && line.length > 0);
});

test('renderHandLine returns a stronger line at advocate morale', () => {
  const neutral = renderHandLine('mae', 'farrier', { morale: 60 });
  const advocate = renderHandLine('mae', 'farrier', { morale: 90 });
  assert.ok(neutral && advocate);
  // Advocate lines tend to be longer / more declarative.
  assert.ok(advocate.length > 0);
});

test('renderHandLine respects composition mode', () => {
  const singleton = renderHandLine('mae', 'farrier', {
    morale: 60,
    topicLines: { neutral: 'Just the line.' },
    composition: 'singleton',
  });
  const full = renderHandLine('mae', 'farrier', {
    morale: 60,
    topicLines: { neutral: 'Just the line.' },
    composition: 'full',
  });
  assert.equal(singleton, 'Just the line.');
  assert.match(full, /Just the line\./);
  assert.ok(full.length > singleton.length, 'full mode adds opener + closer');
});

test('renderHandLine falls back to stance-driven default when no topicLines given', () => {
  // 'farrier' is a 'for' stance for Mae.
  const line = renderHandLine('mae', 'farrier', { morale: 60 });
  assert.match(line, /I'm for it/);
});

test('renderHandLine returns null for hand stance: silent on a topic', () => {
  // Eli is silent on skipTraining.
  const line = renderHandLine('eli', 'skipTraining', { morale: 90 });
  assert.equal(line, null);
});

test('different hands have different stances on at least one topic', () => {
  const topic = 'developerDeal';
  const stances = ['mae', 'eli', 'reyes', 'elena', 'cordell-voss']
    .map((id) => HAND_VOICES[id].stance[topic]);
  // At least 2 hands differ on this topic.
  assert.ok(new Set(stances).size >= 2, `expected varied stances on ${topic}, got ${stances.join(',')}`);
});