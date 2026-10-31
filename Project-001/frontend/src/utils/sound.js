// Web Audio API Sound Synthesizer for RL Playground
// Zero external assets, 0ms latency, works completely offline and in all browsers.

let audioCtx = null;
let soundEnabled = true;

// Retrieve persisted mute preference if available
try {
  const saved = localStorage.getItem('rl_sound_enabled');
  if (saved !== null) {
    soundEnabled = saved === 'true';
  }
} catch {
  // Ignore localStorage errors (e.g. incognito)
}

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function setSoundEnabled(val) {
  soundEnabled = Boolean(val);
  try {
    localStorage.setItem('rl_sound_enabled', String(soundEnabled));
  } catch {}
}

export function toggleSound() {
  const next = !soundEnabled;
  setSoundEnabled(next);
  if (next) {
    playStepSound(0.2);
  }
  return next;
}

/**
 * Gentle wooden/digital footstep tap for agent movement
 */
export function playStepSound(volume = 0.22) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(340, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.035);

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.04);
  } catch {}
}

/**
 * Triumphant ascending arpeggio when agent reaches Goal
 */
export function playGoalSound(volume = 0.35) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const noteDuration = 0.08;

    notes.forEach((freq, idx) => {
      const t = ctx.currentTime + idx * noteDuration;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + noteDuration * 1.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + noteDuration * 1.6);
    });
  } catch {}
}

/**
 * Low plunging buzz when agent falls into a Cliff / Lava
 */
export function playCliffSound(volume = 0.35) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.22);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(80, t + 0.22);

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.25);
  } catch {}
}

/**
 * Sci-fi ethereal frequency sweep for Portal warp
 */
export function playPortalSound(volume = 0.35) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.1);
    osc.frequency.exponentialRampToValueAtTime(540, t + 0.22);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.25);
  } catch {}
}

/**
 * Squishy low-frequency sound for Mud swamp
 */
export function playMudSound(volume = 0.28) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.06);

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.08);
  } catch {}
}

/**
 * Crisp high slide for slippery Ice
 */
export function playIceSound(volume = 0.25) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, t);
    osc.frequency.exponentialRampToValueAtTime(850, t + 0.09);

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.11);
  } catch {}
}

/**
 * Subtle click for UI buttons
 */
export function playClickSound(volume = 0.15) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(750, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.015);

    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(t);
    osc.stop(t + 0.02);
  } catch {}
}

/**
 * Bright metallic chime when agent picks up a Key
 */
export function playKeySound(volume = 0.3) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [880, 1318.5, 1760]; // A5, E6, A6 chime
    notes.forEach((freq, idx) => {
      const t = ctx.currentTime + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.17);
    });
  } catch {}
}

/**
 * Satisfying latch unlock and creak sound when Door opens
 */
export function playDoorOpenSound(volume = 0.28) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const t = ctx.currentTime;
    
    // Quick latch click
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(580, t);
    osc1.frequency.exponentialRampToValueAtTime(180, t + 0.03);
    gain1.gain.setValueAtTime(volume * 0.8, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.04);

    // Warm resonant tone for door opening
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(420, t + 0.03);
    osc2.frequency.exponentialRampToValueAtTime(560, t + 0.14);
    gain2.gain.setValueAtTime(0.001, t + 0.03);
    gain2.gain.linearRampToValueAtTime(volume, t + 0.06);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.03);
    osc2.stop(t + 0.19);
  } catch {}
}

/**
 * Heavy dull thud when agent bumps into a locked Door
 */
export function playDoorLockedSound(volume = 0.25) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    [0, 0.06].forEach((offset) => {
      const t = ctx.currentTime + offset;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.04);

      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.05);
    });
  } catch {}
}
