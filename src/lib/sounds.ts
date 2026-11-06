const STORAGE_KEY = 'pathfinder.sound.v1';

const ROOM_SECONDS = 0.4;
const ROOM_LEVEL = 0.14;
const NOISE_SECONDS = 0.1;

interface Output {
  c: AudioContext;
  dry: GainNode;
  wet: ConvolverNode;
  noise: AudioBuffer;
}

let output: Output | null = null;

/** A small, soft room, so sounds feel like they happen somewhere rather than in a speaker. */
function roomTail(c: AudioContext): AudioBuffer {
  const length = Math.floor(c.sampleRate * ROOM_SECONDS);
  const tail = c.createBuffer(2, length, c.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = tail.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return tail;
}

function noiseBurst(c: AudioContext): AudioBuffer {
  const length = Math.floor(c.sampleRate * NOISE_SECONDS);
  const buffer = c.createBuffer(1, length, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function getOutput(): Output {
  if (!output) {
    const c = new AudioContext();
    const dry = c.createGain();
    dry.gain.value = 0.7;
    dry.connect(c.destination);
    const wet = c.createConvolver();
    wet.buffer = roomTail(c);
    const level = c.createGain();
    level.gain.value = ROOM_LEVEL;
    wet.connect(level).connect(dry);
    output = { c, dry, wet, noise: noiseBurst(c) };
  }
  if (output.c.state === 'suspended') void output.c.resume();
  return output;
}

/** One soft mallet strike: a warm tone with a brief, quiet overtone on top. */
function strike(freq: number, delay = 0, gain = 0.1, duration = 0.34) {
  const { c, dry, wet } = getOutput();
  const start = c.currentTime + delay;

  const partial = (ratio: number, level: number, length: number) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq * ratio;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(level, start + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, start + length);
    o.connect(g);
    g.connect(dry);
    g.connect(wet);
    o.start(start);
    o.stop(start + length);
  };

  partial(1, gain, duration);
  partial(3.9, gain * 0.16, duration * 0.3);
}

/** The smallest sound there is: one pass of a receipt printer's head. */
function tick(delay: number, gain: number) {
  const { c, dry, noise } = getOutput();
  const start = c.currentTime + delay;
  const source = c.createBufferSource();
  source.buffer = noise;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 3400;
  filter.Q.value = 1.1;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.014);
  source.connect(filter).connect(g).connect(dry);
  source.start(start);
  source.stop(start + 0.02);
}

// Notes from one C major chord, so anything that overlaps stays in tune
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.51;

const PRINT_TICKS = 6;
const PRINT_GAP = 0.021;

const sounds = {
  tap() {
    strike(G5, 0, 0.04, 0.1);
  },
  pop() {
    strike(E5, 0, 0.055, 0.18);
  },
  /** A line of the receipt printing. */
  print() {
    for (let i = 0; i < PRINT_TICKS; i++) tick(i * PRINT_GAP, 0.05 - i * 0.004);
  },
  next() {
    strike(C5, 0, 0.055, 0.2);
    strike(E5, 0.07, 0.055, 0.26);
  },
  success() {
    strike(E5, 0, 0.06, 0.22);
    strike(G5, 0.08, 0.07, 0.34);
  },
  /** Money found. The one sound worth looking forward to. */
  found() {
    strike(G5, 0, 0.06, 0.24);
    strike(C6, 0.09, 0.07, 0.3);
    strike(E6, 0.18, 0.06, 0.7);
  },
  complete() {
    strike(C5, 0, 0.06, 0.3);
    strike(G5, 0.1, 0.06, 0.34);
    strike(C6, 0.2, 0.07, 0.8);
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
