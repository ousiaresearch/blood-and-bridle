// Soundtrack integration for Blood & Bridle
// Loads pre-generated music loops, crossfades between moods, handles mute.
//
// The track manifest is loaded lazily so this module is safe to import even
// when the assets haven't been generated yet (the game runs silent and
// fallbacks to no music). This mirrors the portraits module's pattern.

let trackManifest = null;        // resolved manifest module
let trackManifestFailed = false; // sentinel: don't retry on every call
let trackManifestPromise = null; // in-flight load promise

async function loadTrackManifest() {
  if (trackManifest) return trackManifest;
  if (trackManifestFailed) return null;
  if (trackManifestPromise) return trackManifestPromise;
  trackManifestPromise = (async () => {
    try {
      const mod = await import('/assets/soundtrack/index.js');
      trackManifest = mod;
      return mod;
    } catch (e) {
      console.debug('Soundtrack tracks not yet generated, running silent');
      trackManifestFailed = true;
      return null;
    } finally {
      trackManifestPromise = null;
    }
  })();
  return trackManifestPromise;
}

class SoundtrackEngine {
  constructor() {
    this.audioContext = null;
    this.gainNode = null;
    this.currentSource = null;
    this.currentTrackId = null;
    this.nextSource = null;
    this.isMuted = false;
    this.volume = 0.35;
    this.crossfadeDuration = 4.0; // seconds
    this.tracks = new Map(); // trackId -> AudioBuffer
    this.loading = new Map(); // trackId -> Promise<AudioBuffer>
  }

  async init() {
    if (this.audioContext) return;
    
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = this.volume;
    this.gainNode.connect(this.audioContext.destination);
    
    // Preload all tracks
    await this.preloadAll();
  }

  async preloadAll() {
    const mod = await loadTrackManifest();
    if (!mod) return;
    try {
      const urls = mod.getAllTrackUrls();
      for (const [trackId, url] of Object.entries(urls)) {
        this.loadTrack(trackId, url);
      }
      // Wait for all to load
      await Promise.all(this.loading.values());
      console.log(`Soundtrack: preloaded ${this.tracks.size} tracks`);
    } catch (e) {
      console.debug('Soundtrack manifest could not be enumerated');
    }
  }

  async loadTrack(trackId, url) {
    if (this.tracks.has(trackId)) return this.tracks.get(trackId);
    if (this.loading.has(trackId)) return this.loading.get(trackId);

    const promise = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.tracks.set(trackId, buffer);
        return buffer;
      } catch (e) {
        console.warn(`Failed to load track ${trackId}:`, e);
        this.loading.delete(trackId);
        throw e;
      }
    })();

    this.loading.set(trackId, promise);
    return promise;
  }

  async play(trackId, { crossfade = true } = {}) {
    await this.init();
    if (this.isMuted) return;

    const buffer = this.tracks.get(trackId);
    if (!buffer) {
      console.warn(`Track ${trackId} not loaded`);
      return;
    }

    // If same track already playing, do nothing
    if (this.currentTrackId === trackId && this.currentSource) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.gainNode);

    if (crossfade && this.currentSource) {
      // Crossfade: fade out current, fade in new
      const now = this.audioContext.currentTime;
      
      // Fade out current
      this.gainNode.gain.cancelScheduledValues(now);
      this.gainNode.gain.setValueAtTime(this.volume, now);
      this.gainNode.gain.exponentialRampToValueAtTime(0.001, now + this.crossfadeDuration);
      
      // Start new at low volume, fade in
      const nextGain = this.audioContext.createGain();
      nextGain.gain.value = 0.001;
      nextGain.connect(this.gainNode);
      
      const nextSource = this.audioContext.createBufferSource();
      nextSource.buffer = buffer;
      nextSource.loop = true;
      nextSource.connect(nextGain);
      
      nextSource.start(now);
      nextGain.gain.exponentialRampToValueAtTime(this.volume, now + this.crossfadeDuration);
      
      // Clean up old source after crossfade
      setTimeout(() => {
        try { this.currentSource.stop(); } catch {}
        try { this.currentSource.disconnect(); } catch {}
        this.currentSource = nextSource;
        this.currentTrackId = trackId;
        // Restore main gain
        this.gainNode.gain.value = this.volume;
        nextGain.disconnect();
        source.connect(this.gainNode);
      }, this.crossfadeDuration * 1000 + 100);
      
    } else {
      // Hard switch
      if (this.currentSource) {
        try { this.currentSource.stop(); } catch {}
        try { this.currentSource.disconnect(); } catch {}
      }
      source.start(0);
      this.currentSource = source;
      this.currentTrackId = trackId;
    }
  }

  stop() {
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch {}
      try { this.currentSource.disconnect(); } catch {}
      this.currentSource = null;
      this.currentTrackId = null;
    }
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (muted) {
      this.stop();
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && !this.isMuted) {
      this.gainNode.gain.value = this.volume;
    }
  }

  getCurrentTrack() {
    return this.currentTrackId;
  }

  // Resume AudioContext on user gesture (required by browser policy)
  async resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}

// Singleton instance
export const soundtrack = new SoundtrackEngine();

// Convenience functions for game integration
export async function playForSeason(season) {
  const mod = await loadTrackManifest();
  if (!mod) return; // silent fallback when assets aren't generated
  const trackId = mod.getTrackIdForSeason(season);
  await soundtrack.play(trackId);
}

export async function playForMood(mood) {
  // mood: 'spring' | 'summer' | 'autumn' | 'winter' | 'show' | 'crisis' | 'legacy' | 'ending'
  const mod = await loadTrackManifest();
  if (!mod) return; // silent fallback when assets aren't generated
  const trackMap = {
    spring: 'spring-warm',
    summer: 'summer-dust',
    autumn: 'autumn-harvest',
    winter: 'winter-sparse',
    show: 'show-circuit',
    crisis: 'crisis',
    legacy: 'legacy-moment',
    ending: 'ending'
  };
  const trackId = trackMap[mood] || 'spring-warm';
  await soundtrack.play(trackId);
}

export function stopSoundtrack() {
  soundtrack.stop();
}

export function setSoundtrackMuted(muted) {
  soundtrack.setMuted(muted);
}

export function setSoundtrackVolume(vol) {
  soundtrack.setVolume(vol);
}