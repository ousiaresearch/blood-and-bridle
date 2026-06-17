// Audio engine. All sounds are synthesized via the Web Audio API. No audio
// files. The engine accepts an injected audioContextFactory so tests can run
// in Node without a real AudioContext.
//
// Sound design principles:
// - Short durations (30-300ms). Sound effects are punctuation, not music.
// - Use sine + triangle for warmth. Square for click. Sawtooth avoided.
// - Soft attack and decay envelopes prevent clicks-on-clicks.
// - Master gain is low (0.18) so nothing startles the player.
// - Brian Tyler / Yellowstone rule: leave the human imperfection audible.
//   We don't polish to perfection. The bowed-cello memorial has a slow LFO
//   vibrato. The bronze bell has inharmonic partials. The thunder rumble
//   sweeps down, not just on.

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
  // Bronze bell: church-bell timbre with strong inharmonic partials
  bell:         { type: 'bell',   freq: 880, dur: 1.20, gain: 0.10, harmonics: [1, 2.76, 5.40, 8.93] },
  // Memorial: deep bowed-cello tone. Three detuned sine partials plus
  // a slow LFO on partials 2 and 3 for vibrato. Replaces a single-sine
  // tone — feels bowed, not synth.
  memorial:     { type: 'bowed',  freq: 110, dur: 1.40, gain: 0.14, partials: [1, 2.005, 3.01], vibratoHz: 4.5, vibratoCents: 8 },
  // Telegram bell: high single ping, like a Western Union office call.
  // Sharp attack, fast decay.
  telegram:     { type: 'bell',   freq: 1480, dur: 0.55, gain: 0.12, harmonics: [1, 2.4, 4.7] },
  // Rooster: morning chirp. Three ascending pulses.
  rooster:      { type: 'seq',    notes: [{ freq: 700, dur: 0.08 }, { freq: 900, dur: 0.08 }, { freq: 1100, dur: 0.14 }], gain: 0.10, wave: 'triangle', spacing: 0.10 },
  // Thunder: long low rumble, filter sweeps down over 1.4s.
  thunder:      { type: 'noise',  dur: 1.40, gain: 0.16, filterStart: 180, filterEnd: 60, filterQ: 1.4, sweep: 'down' },
  // Iron brand stamp: a sharp high transient followed by a low thud.
  stamp:        { type: 'seq',    notes: [{ freq: 2200, dur: 0.02 }, { freq: 80, dur: 0.18 }], gain: 0.18, wave: 'sine', spacing: 0.04 },
  // Bowed-cello stinger: the theme that plays during the time-jump card.
  celloStinger: { type: 'bowed',  freq: 110, dur: 2.50, gain: 0.16, partials: [1, 2.003], vibratoHz: 4.0, vibratoCents: 14 },
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
  let ambientOsc = null;
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
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    return { osc, gain };
  }

  // Filtered noise burst. Used for organic, textural sounds like a
  // gate creak or distant thunder.
  function playNoise(spec) {
    if (!ctx || !master) return null;
    const dur = spec.dur || 0.3;
    const t0 = ctx.currentTime;
    const peak = (spec.gain || 0.1) * (muted ? 0 : 1);

    const bufferLen = Math.max(1, Math.floor(ctx.sampleRate * Math.max(0.5, dur + 0.1)));
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
      Math.max(20, spec.filterEnd || 200),
      t0 + dur,
    );

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
    return { src, filter, gain };
  }

  // Bell: fundamental sine plus inharmonic partials. Each partial decays
  // at its own rate — higher partials die first, giving a struck-bell
  // timbre.
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

  // Bowed-cello / bowed-string texture. Multiple sine partials slightly
  // detuned from integer ratios, plus a slow LFO on the second partial
  // for vibrato. The warm, slightly beating quality of a bowed string.
  function playBowed(spec) {
    if (!ctx || !master) return null;
    const dur = spec.dur || 1.4;
    const t0 = ctx.currentTime;
    const peak = (spec.gain || 0.1) * (muted ? 0 : 1);
    const partials = spec.partials || [1, 2];
    const vibratoHz = spec.vibratoHz ?? 4.5;
    const vibratoCents = spec.vibratoCents ?? 8;
    const out = [];

    for (let i = 0; i < partials.length; i++) {
      const ratio = partials[i];
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = spec.freq * ratio;

      if (i > 0 && vibratoCents > 0) {
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = spec.freq * ratio * (Math.pow(2, vibratoCents / 1200) - 1);
        lfo.frequency.value = vibratoHz;
        lfo.connect(lfoGain).connect(osc.frequency);
        lfo.start(t0);
        lfo.stop(t0 + dur + 0.05);
      }

      const gain = ctx.createGain();
      const partialGain = peak / Math.pow(1.6, i);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(partialGain, t0 + 0.08);
      gain.gain.linearRampToValueAtTime(partialGain * 0.85, t0 + dur * 0.6);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      osc.connect(gain).connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
      out.push({ osc, gain });
    }
    return out;
  }

  function play(name) {
    playedLog.push(name);
    const spec = SOUNDS[name];
    if (!spec) return null;
    if (!ensureContext()) return null;
    if (muted) return null;
    if (spec.type === 'tone') return playTone(spec);
    if (spec.type === 'seq') {
      let offset = 0;
      const spacing = spec.spacing ?? null;
      for (const note of spec.notes) {
        playTone({ freq: note.freq, dur: note.dur, gain: spec.gain, wave: spec.wave }, offset);
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
    if (spec.type === 'noise') return playNoise(spec);
    if (spec.type === 'bell') return playBell(spec);
    if (spec.type === 'bowed') return playBowed(spec);
    return null;
  }

  // NPC leitmotifs (Morricone/Leone style). Each NPC has a 3-4 note
  // motif that plays in the first 600ms of any modal involving them.
  // Intervals in semitones from the root.
  const NPC_MOTIFS = {
    'mae':            { root: 392, intervals: [0, 3, 7, 12], wave: 'triangle', gain: 0.10 },
    'eli':            { root: 220, intervals: [0, 5, 7, 10], wave: 'sine',     gain: 0.10 },
    'dr-voss':        { root: 330, intervals: [0, 4, 7, 11], wave: 'sine',     gain: 0.08 },
    'dev-coleman':    { root: 110, intervals: [0, 1, 3, 6],  wave: 'sine',     gain: 0.10 },
    'ranch-cordell':  { root: 294, intervals: [0, 7, 10, 14], wave: 'sine',    gain: 0.09 },
    'banker-ortega':  { root: 175, intervals: [0, 2, 5, 9],  wave: 'sine',     gain: 0.08 },
    'sister-elena':   { root: 440, intervals: [0, 4, 7, 11], wave: 'sine',     gain: 0.10 },
    'rival-callahan': { root: 165, intervals: [0, 3, 6, 8],  wave: 'triangle', gain: 0.10 },
  };

  function playMotif(npcId) {
    if (!ensureContext()) return null;
    if (muted) return null;
    const motif = NPC_MOTIFS[npcId];
    if (!motif) return null;
    for (let i = 0; i < motif.intervals.length; i++) {
      const semis = motif.intervals[i];
      const freq = motif.root * Math.pow(2, semis / 12);
      playTone({ freq, dur: 0.18, gain: motif.gain, wave: motif.wave }, i * 0.10);
    }
    playedLog.push(`motif:${npcId}`);
    return motif.intervals.length;
  }

  function ambient(presetName) {
    const preset = AMBIENT_PRESETS[presetName] || AMBIENT_PRESETS.off;
    if (!ctx || !master) return null;
    if (ambientOsc) {
      try { ambientOsc.stop(); } catch { /* already stopped */ }
      ambientOsc = null;
    }
    if (preset.gain === 0) return null;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = preset.type;
    osc.frequency.value = preset.freq;
    gain.gain.value = preset.gain * (muted ? 0 : 1);
    osc.connect(gain).connect(master);
    osc.start();
    ambientOsc = osc;
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
    playMotif,
    setMuted,
    isMuted,
    ambient,
    resume,
    getPlayedLog,
    clearPlayedLog,
    _ensureContext: ensureContext,
  };
}

function defaultFactory() {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
  return new window.AudioContext();
}

export { SOUNDS, AMBIENT_PRESETS, MUTE_KEY };
export const __INTERNAL__ = { SOUNDS, AMBIENT_PRESETS, MUTE_KEY };