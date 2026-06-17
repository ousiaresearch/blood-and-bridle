// Audio engine. All sounds are synthesized via the Web Audio API. No audio
// files. The engine accepts an injected audioContextFactory so tests can run
// in Node without a real AudioContext.
//
// Sound design principles:
// - Short durations (30-300ms). Sound effects are punctuation, not music.
// - Use sine + triangle for warmth. Square for click. Sawtooth avoided.
// - Soft attack and decay envelopes prevent clicks-on-clicks.
// - Master gain is low (0.18) so nothing startles the player.

const MUTE_KEY = 'blood-and-bridle-mute';

const SOUNDS = {
  // Soft click: any button press
  click:        { type: 'tone',   freq: 180,  dur: 0.04, gain: 0.12, wave: 'square' },
  // Day advance: calendar turning
  tick:         { type: 'tone',   freq: 440,  dur: 0.05, gain: 0.10, wave: 'triangle' },
  // Cash down: low, brief
  cashDown:     { type: 'tone',   freq: 110,  dur: 0.12, gain: 0.14, wave: 'sine' },
  // Cash up: high, brief
  cashUp:       { type: 'tone',   freq: 660,  dur: 0.10, gain: 0.12, wave: 'sine' },
  // Horse sold: descending pair
  sale:         { type: 'seq',    notes: [{ freq: 330, dur: 0.10 }, { freq: 220, dur: 0.18 }], gain: 0.14, wave: 'sine' },
  // Show entered: soft chord (three notes simultaneously)
  showEnter:    { type: 'chord',  notes: [{ freq: 330 }, { freq: 440 }, { freq: 550 }], dur: 0.30, gain: 0.08, wave: 'sine' },
  // Show result: champion — ascending arpeggio
  champion:     { type: 'seq',    notes: [{ freq: 440, dur: 0.10 }, { freq: 554, dur: 0.10 }, { freq: 659, dur: 0.18 }], gain: 0.16, wave: 'triangle' },
  // Show result: also-ran — single muted thud
  alsoRan:      { type: 'tone',   freq: 80,   dur: 0.18, gain: 0.16, wave: 'sine' },
  // Tutorial step done: soft chime
  stepDone:     { type: 'tone',   freq: 880,  dur: 0.10, gain: 0.10, wave: 'sine' },
  // Event triggered: low rumble
  event:        { type: 'tone',   freq: 60,   dur: 0.22, gain: 0.14, wave: 'sine' },
  // Error: brief buzz
  error:        { type: 'tone',   freq: 130,  dur: 0.10, gain: 0.14, wave: 'square' },
  // Confirmed (accept, sign): warm mid chord
  confirm:      { type: 'chord',  notes: [{ freq: 392 }, { freq: 494 }], dur: 0.18, gain: 0.10, wave: 'sine' },
  // Hoofbeats: four low thumps at a slow canter cadence
  hoofbeat:     { type: 'seq',    notes: [{ freq: 70, dur: 0.06 }, { freq: 70, dur: 0.06 }, { freq: 70, dur: 0.06 }, { freq: 70, dur: 0.06 }], gain: 0.18, wave: 'sine', spacing: 0.32 },
  // Gate creak: rising-pitch filtered noise burst
  gateCreak:    { type: 'noise',  dur: 0.42, gain: 0.10, filterStart: 600, filterEnd: 2200, filterQ: 8, sweep: 'up' },
  // Bell: striking a metal triangle / arena bell. Decaying fundamental + 2 harmonics
  bell:         { type: 'bell',   freq: 880, dur: 1.20, gain: 0.10, harmonics: [1, 2.76, 5.40] },
  // Memorial: deep low tone with slow decay — for horse eulogies
  memorial:     { type: 'tone',   freq: 110, dur: 1.40, gain: 0.14, wave: 'sine' },
};

const AMBIENT_PRESETS = {
  off:   { freq: 0,     gain: 0,    type: 'sine' },
  wind:  { freq: 90,    gain: 0.04, type: 'sine' },
  rain:  { freq: 140,   gain: 0.05, type: 'triangle' },
  drone: { freq: 55,    gain: 0.05, type: 'sine' },
  winter:{ freq: 70,    gain: 0.04, type: 'sine' },
};

function loadMute() {
  try {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveMute(muted) {
  try {
    if (typeof localStorage === 'undefined') return;
    if (muted) localStorage.setItem(MUTE_KEY, '1');
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    /* ignore */
  }
}

export function createAudioEngine({ audioContextFactory = defaultFactory, masterGain = 0.18, storage = null } = {}) {
  let ctx = null;
  let master = null;
  let muted = storage ? storage.muted : loadMute();
  const playedLog = []; // for tests

  function ensureContext() {
    if (ctx) return ctx;
    if (typeof audioContextFactory !== 'function') return null;
    ctx = audioContextFactory();
    if (!ctx) return null;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : masterGain;
    master.connect(ctx.destination);
    return ctx;
  }

  function setMuted(value) {
    muted = !!value;
    saveMuted();
    if (master) master.gain.value = muted ? 0 : masterGain;
    return muted;
  }

  function saveMuted() {
    if (storage) storage.muted = muted;
    else saveMute(muted);
  }

  function isMuted() {
    return muted;
  }

  function playTone(spec, startAt = 0) {
    if (!ctx || !master) return null;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = spec.wave || 'sine';
    osc.frequency.value = spec.freq;
    const t0 = ctx.currentTime + startAt;
    const dur = spec.dur;
    const peak = (spec.gain || 0.1) * (muted ? 0 : 1);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.005); // 5ms attack
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // exponential decay
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    return { osc, gain };
  }

  // Filtered noise burst. Used for organic, textural sounds like a
  // gate creak. Builds a short noise buffer, runs it through a bandpass
  // filter that sweeps from filterStart to filterEnd over the duration.
  function playNoise(spec) {
    if (!ctx || !master) return null;
    const dur = spec.dur || 0.3;
    const t0 = ctx.currentTime;
    const peak = (spec.gain || 0.1) * (muted ? 0 : 1);

    // Build ~0.5s of white noise (longer than longest expected burst).
    const bufferLen = Math.max(1, Math.floor(ctx.sampleRate * 0.5));
    const buffer = ctx.createBuffer(1, bufferLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferLen; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = spec.filterQ || 6;
    filter.frequency.setValueAtTime(spec.filterStart || 800, t0);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(50, spec.filterEnd || 200),
      t0 + dur,
    );

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.04); // 40ms attack
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
    return { src, filter, gain };
  }

  // Bell: a fundamental sine plus inharmonic partials (1, 2.76, 5.40 give
  // a struck-bell timbre without sounding like a real recording). Each
  // partial decays at its own rate — higher partials die first.
  function playBell(spec) {
    if (!ctx || !master) return null;
    const dur = spec.dur || 1.2;
    const t0 = ctx.currentTime;
    const peak = (spec.gain || 0.1) * (muted ? 0 : 1);
    const harmonics = spec.harmonics || [1, 2.76, 5.40];
    const partials = [];

    for (let i = 0; i < harmonics.length; i++) {
      const ratio = harmonics[i];
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = spec.freq * ratio;
      const gain = ctx.createGain();
      // Higher partials are quieter and decay faster.
      const partialGain = peak / (i + 1);
      const partialDur = dur / (1 + i * 0.4);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(partialGain, t0 + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + partialDur);
      osc.connect(gain).connect(master);
      osc.start(t0);
      osc.stop(t0 + partialDur + 0.02);
      partials.push({ osc, gain });
    }
    return partials;
  }

  function play(name) {
    playedLog.push(name);
    const spec = SOUNDS[name];
    if (!spec) return null;
    if (!ensureContext()) return null;
    if (muted) return null;
    if (spec.type === 'tone') {
      return playTone(spec);
    }
    if (spec.type === 'seq') {
      let offset = 0;
      const spacing = spec.spacing ?? null;
      for (const note of spec.notes) {
        playTone({ freq: note.freq, dur: note.dur, gain: spec.gain, wave: spec.wave }, offset);
        // If `spacing` is set, use it as the gap between notes (independent of note dur).
        // Otherwise fall back to the old behavior: 0.85 of note duration.
        offset += spacing ?? (note.dur * 0.85);
      }
      return spec.notes.length;
    }
    if (spec.type === 'chord') {
      for (const note of spec.notes) {
        playTone({ freq: note.freq, dur: spec.dur, gain: spec.gain, wave: spec.wave });
      }
      return spec.notes.length;
    }
    if (spec.type === 'noise') {
      return playNoise(spec);
    }
    if (spec.type === 'bell') {
      return playBell(spec);
    }
    return null;
  }

  function ambient(presetName) {
    const preset = AMBIENT_PRESETS[presetName] || AMBIENT_PRESETS.off;
    if (!ctx || !master) return null;
    if (ambient.osc) {
      try { ambient.osc.stop(); } catch { /* already stopped */ }
      ambient.osc = null;
    }
    if (preset.gain === 0) return null;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = preset.type;
    osc.frequency.value = preset.freq;
    gain.gain.value = preset.gain * (muted ? 0 : 1);
    osc.connect(gain).connect(master);
    osc.start();
    ambient.osc = osc;
    return { osc, gain };
  }

  function resume() {
    if (ctx && typeof ctx.resume === 'function') {
      try { ctx.resume(); } catch { /* ignore */ }
    }
  }

  function getPlayedLog() {
    return playedLog.slice();
  }

  function clearPlayedLog() {
    playedLog.length = 0;
  }

  return {
    play,
    setMuted,
    isMuted,
    ambient,
    resume,
    getPlayedLog,
    clearPlayedLog,
    // exposed for tests
    _ensureContext: ensureContext,
  };
}

function defaultFactory() {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
  return new window.AudioContext();
}

export { SOUNDS, AMBIENT_PRESETS, MUTE_KEY };
export const __INTERNAL__ = { SOUNDS, AMBIENT_PRESETS, MUTE_KEY };
