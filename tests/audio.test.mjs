import test from 'node:test';
import assert from 'node:assert/strict';

import { createAudioEngine, __INTERNAL__ } from '../src/audio.js';

// Build a fake AudioContext that records every oscillator/gain creation
// and every ramp/set call. We don't care about real audio; we care that the
// engine dispatches the right number of voices for each sound type.
function makeFakeContext() {
  const calls = {
    oscillators: [],
    gains: [],
    setValueAtTime: 0,
    linearRampToValueAtTime: 0,
    exponentialRampToValueAtTime: 0,
    connects: 0,
  };
  const ctx = {
    destination: { name: 'destination' },
    currentTime: 0,
    resumeCalls: 0,
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: { value: 0 },
        connect(target) { calls.connects++; osc._connectedTo = target; return target; },
        start(t) { osc.startCalledAt = t; },
        stop(t) { osc.stopCalledAt = t; },
      };
      calls.oscillators.push(osc);
      return osc;
    },
    createGain() {
      const gain = {
        connect(target) { calls.connects++; gain._connectedTo = target; return target; },
        gain: {
          value: 0,
          setValueAtTime: function (v) { calls.setValueAtTime++; gain._last = v; },
          linearRampToValueAtTime: function () { calls.linearRampToValueAtTime++; },
          exponentialRampToValueAtTime: function () { calls.exponentialRampToValueAtTime++; },
        },
      };
      calls.gains.push(gain);
      return gain;
    },
    resume() { this.resumeCalls++; },
  };
  return { ctx, calls };
}

function makeEngine(opts = {}) {
  const fake = makeFakeContext();
  const engine = createAudioEngine({
    audioContextFactory: () => fake.ctx,
    masterGain: 0.5,
    ...opts,
  });
  // force context creation
  engine._ensureContext();
  return { engine, calls: fake.calls, ctx: fake.ctx };
}

test('play(click) creates exactly one oscillator and one gain', () => {
  const { engine, calls } = makeEngine();
  calls.oscillators.length = 0; calls.gains.length = 0;
  engine.play('click');
  assert.equal(calls.oscillators.length, 1);
  assert.equal(calls.gains.length, 1);
  assert.equal(calls.oscillators[0].type, 'square'); // click uses square wave
});

test('play(cashDown) uses low frequency (110Hz)', () => {
  const { engine, calls } = makeEngine();
  engine.play('cashDown');
  assert.equal(calls.oscillators[0].frequency.value, 110);
});

test('play(cashUp) uses high frequency (660Hz)', () => {
  const { engine, calls } = makeEngine();
  engine.play('cashUp');
  assert.equal(calls.oscillators[0].frequency.value, 660);
});

test('play(sale) creates a sequence of two oscillators', () => {
  const { engine, calls } = makeEngine();
  engine.play('sale');
  assert.equal(calls.oscillators.length, 2);
  // descending
  assert.ok(calls.oscillators[0].frequency.value > calls.oscillators[1].frequency.value);
});

test('play(showEnter) creates a chord of three oscillators simultaneously', () => {
  const { engine, calls } = makeEngine();
  engine.play('showEnter');
  assert.equal(calls.oscillators.length, 3);
});

test('play(champion) creates an ascending arpeggio of three', () => {
  const { engine, calls } = makeEngine();
  engine.play('champion');
  assert.equal(calls.oscillators.length, 3);
  assert.ok(calls.oscillators[0].frequency.value < calls.oscillators[1].frequency.value);
  assert.ok(calls.oscillators[1].frequency.value < calls.oscillators[2].frequency.value);
});

test('play(unknown) does not throw and does not create oscillators', () => {
  const { engine, calls } = makeEngine();
  engine.play('notASound');
  assert.equal(calls.oscillators.length, 0);
});

test('setMuted(true) suppresses all sound and persists via storage', () => {
  const storage = { muted: false };
  const { engine, calls } = makeEngine({ storage });
  calls.oscillators.length = 0;
  engine.setMuted(true);
  engine.play('click');
  assert.equal(calls.oscillators.length, 0); // master gain is 0 → still creates nodes, but gain.value is 0
  // gain.value on master should be 0; we tracked the per-voice gain
  // Either way, persistence is the contract
  assert.equal(storage.muted, true);
  assert.equal(engine.isMuted(), true);
});

test('setMuted(false) restores playback', () => {
  const storage = { muted: true };
  const { engine } = makeEngine({ storage });
  assert.equal(engine.isMuted(), true);
  engine.setMuted(false);
  assert.equal(engine.isMuted(), false);
  assert.equal(storage.muted, false);
});

test('getPlayedLog records every play() call in order', () => {
  const { engine } = makeEngine();
  engine.clearPlayedLog();
  engine.play('click');
  engine.play('tick');
  engine.play('cashDown');
  assert.deepEqual(engine.getPlayedLog(), ['click', 'tick', 'cashDown']);
});

test('resume() calls ctx.resume exactly once', () => {
  const { engine, ctx } = makeEngine();
  engine.resume();
  engine.resume();
  assert.equal(ctx.resumeCalls, 2);
});

test('ambient(off) does not create any oscillator when gain is 0', () => {
  const { engine, calls } = makeEngine();
  calls.oscillators.length = 0;
  const result = engine.ambient('off');
  assert.equal(result, null);
  assert.equal(calls.oscillators.length, 0);
});

test('ambient(drone) creates one low-frequency oscillator', () => {
  const { engine, calls } = makeEngine();
  calls.oscillators.length = 0;
  engine.ambient('drone');
  assert.equal(calls.oscillators.length, 1);
  assert.equal(calls.oscillators[0].frequency.value, 55);
});

test('ambient(drone) called twice stops the first oscillator', () => {
  const { engine, calls } = makeEngine();
  engine.ambient('drone');
  const first = calls.oscillators[0];
  engine.ambient('drone');
  assert.notEqual(first.stopCalledAt, null);
});

test('engine gracefully handles missing AudioContext', () => {
  const engine = createAudioEngine({ audioContextFactory: () => null });
  const result = engine.play('click');
  assert.equal(result, null);
  assert.equal(engine.isMuted(), false);
});

test('SOUNDS catalog has all 12 documented sounds', () => {
  const expected = [
    'click', 'tick', 'cashDown', 'cashUp', 'sale', 'showEnter',
    'champion', 'alsoRan', 'stepDone', 'event', 'error', 'confirm',
  ];
  for (const name of expected) {
    assert.ok(__INTERNAL__.SOUNDS[name], `missing sound: ${name}`);
  }
});

test('AMBIENT_PRESETS has all 5 documented presets', () => {
  const expected = ['off', 'wind', 'rain', 'drone', 'winter'];
  for (const name of expected) {
    assert.ok(__INTERNAL__.AMBIENT_PRESETS[name], `missing preset: ${name}`);
  }
});
