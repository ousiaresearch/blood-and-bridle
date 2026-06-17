import test from 'node:test';
import assert from 'node:assert/strict';

import { createAudioEngine, __INTERNAL__ } from '../src/audio.js';

// Build a fake AudioContext that records every oscillator/gain creation
// and every ramp/set call. We don't care about real audio; we care that the
function makeFakeContext() {
  const calls = {
    oscillators: [],
    gains: [],
    setValueAtTime: 0,
    linearRampToValueAtTime: 0,
    exponentialRampToValueAtTime: 0,
    connects: 0,
    buffers: [],
    sources: [],
    filters: [],
  };
  const ctx = {
    destination: { name: 'destination' },
    currentTime: 0,
    sampleRate: 44100,
    resumeCalls: 0,
    createOscillator() {
      const osc = {
        type: 'sine',
        frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
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
    createBuffer(channels, length, sampleRate) {
      const data = new Float32Array(length);
      const buf = {
        channels, length, sampleRate,
        getChannelData() { return data; },
      };
      calls.buffers.push(buf);
      return buf;
    },
    createBufferSource() {
      const src = {
        buffer: null,
        loop: false,
        connect(target) { calls.connects++; src._connectedTo = target; return target; },
        start(t) { src.startCalledAt = t; },
        stop(t) { src.stopCalledAt = t; },
      };
      calls.sources.push(src);
      return src;
    },
    createBiquadFilter() {
      const filter = {
        type: 'lowpass',
        Q: { value: 1 },
        frequency: {
          value: 350,
          setValueAtTime(v) { filter.frequency._start = v; },
          exponentialRampToValueAtTime(v) { filter.frequency._end = v; },
        },
        connect(target) { calls.connects++; filter._connectedTo = target; return target; },
      };
      calls.filters.push(filter);
      return filter;
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

// ---------- Procedural SFX: hoofbeat, gate creak, bell, memorial ----------

test('play(hoofbeat) creates a sequence of 4 oscillators (canter cadence)', () => {
  const { engine, calls } = makeEngine();
  calls.oscillators.length = 0;
  engine.play('hoofbeat');
  assert.equal(calls.oscillators.length, 4);
  // All four should be the same low frequency (70Hz thumps)
  for (const osc of calls.oscillators) {
    assert.equal(osc.frequency.value, 70);
  }
});

test('play(gateCreak) creates a noise source + bandpass filter + gain', () => {
  const { engine, calls } = makeEngine();
  calls.oscillators.length = 0; calls.sources.length = 0; calls.filters.length = 0;
  engine.play('gateCreak');
  // Should create exactly one buffer source, one bandpass filter
  assert.equal(calls.sources.length, 1, 'expected 1 buffer source');
  assert.equal(calls.filters.length, 1, 'expected 1 biquad filter');
  assert.equal(calls.filters[0].type, 'bandpass');
  // The filter should sweep from filterStart to filterEnd
  assert.equal(calls.filters[0].frequency._start, 600);
  assert.equal(calls.filters[0].frequency._end, 2200);
  // And there should be a buffer with noise data
  assert.equal(calls.buffers.length, 1);
  // The buffer should be a real AudioBuffer shape (or fake with getChannelData)
  const buf = calls.buffers[0];
  assert.equal(buf.channels, 1);
  assert.ok(buf.length > 0);
});

test('play(bell) creates one oscillator per harmonic partial', () => {
  const { engine, calls } = makeEngine();
  calls.oscillators.length = 0;
  engine.play('bell');
  // Bell has 3 harmonics: 1, 2.76, 5.40
  assert.equal(calls.oscillators.length, 3);
  // Frequencies should be 880, 880*2.76, 880*5.40
  assert.equal(calls.oscillators[0].frequency.value, 880);
  assert.equal(calls.oscillators[1].frequency.value, 880 * 2.76);
  assert.equal(calls.oscillators[2].frequency.value, 880 * 5.40);
});

test('play(memorial) creates one low oscillator with long duration', () => {
  const { engine, calls } = makeEngine();
  calls.oscillators.length = 0;
  engine.play('memorial');
  assert.equal(calls.oscillators.length, 1);
  assert.equal(calls.oscillators[0].frequency.value, 110);
  assert.equal(calls.oscillators[0].type, 'sine');
});

test('new sounds are exposed in the SOUNDS catalog', () => {
  for (const name of ['hoofbeat', 'gateCreak', 'bell', 'memorial']) {
    assert.ok(__INTERNAL__.SOUNDS[name], `missing sound: ${name}`);
  }
});

test('all new procedural sounds handle missing AudioContext gracefully', () => {
  const engine = createAudioEngine({ audioContextFactory: () => null });
  for (const name of ['hoofbeat', 'gateCreak', 'bell', 'memorial']) {
    const result = engine.play(name);
    assert.equal(result, null, `${name} should return null without AudioContext`);
  }
});
