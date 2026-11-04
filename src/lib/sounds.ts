const STORAGE_KEY = 'pathfinder.sound.v1';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function getOutput(): { c: AudioContext; out: GainNode } {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.7;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return { c: ctx, out: master! };
}

/** One soft mallet strike: a warm tone with a brief, quiet overtone on top. */
function strike(freq: number, delay = 0, gain = 0.1, duration = 0.34) {
  const { c, out } = getOutput();
  const start = c.currentTime + delay;

  const partial = (ratio: number, level: number, length: number) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq * ratio;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(level, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, start + length);
    o.connect(g).connect(out);
    o.start(start);
    o.stop(start + length);
  };

  partial(1, gain, duration);
  partial(3.9, gain * 0.16, duration * 0.3);
}

// Notes from one C major chord, so anything that overlaps stays in tune
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

const sounds = {
  tap() {
    strike(G5, 0, 0.045, 0.12);
  },
  pop() {
    strike(E5, 0, 0.06, 0.18);
  },
  next() {
    strike(C5, 0, 0.06, 0.2);
    strike(E5, 0.07, 0.06, 0.26);
  },
  success() {
    strike(E5, 0, 0.07, 0.22);
    strike(G5, 0.08, 0.08, 0.34);
  },
  complete() {
    strike(C5, 0, 0.07, 0.3);
    strike(E5, 0.09, 0.07, 0.3);
    strike(G5, 0.18, 0.07, 0.34);
    strike(C6, 0.27, 0.08, 0.6);
  },
};

export type SoundName = keyof typeof sounds;

let enabled = readEnabled();
const listeners = new Set<() => void>();

function readEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function isSoundEnabled(): boolean {
  return enabled;
}

export function subscribeToSound(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toggleSound(): void {
  enabled = !enabled;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // Ignore storage failures (private mode/quota)
  }
  listeners.forEach((listener) => listener());
  if (enabled) playSound('pop');
}

export function playSound(name: SoundName) {
  if (!enabled) return;
  try {
    sounds[name]();
  } catch {
    // AudioContext not available (SSR, old browser) — silent fail
  }
}
