let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function osc(
  freq: number,
  duration: number,
  type: OscillatorType = 'sine',
  gain = 0.12,
  delay = 0,
) {
  const c = getCtx();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + delay);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + delay + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + delay + duration);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + delay);
  o.stop(c.currentTime + delay + duration);
}

const sounds = {
  tap() {
    osc(800, 0.06, 'sine', 0.08);
  },
  success() {
    osc(523, 0.15, 'sine', 0.1);
    osc(659, 0.15, 'sine', 0.1, 0.1);
    osc(784, 0.2, 'sine', 0.1, 0.2);
  },
  complete() {
    osc(440, 0.12, 'sine', 0.1);
    osc(554, 0.12, 'sine', 0.1, 0.08);
    osc(659, 0.12, 'sine', 0.1, 0.16);
    osc(880, 0.25, 'sine', 0.12, 0.24);
  },
  pop() {
    osc(600, 0.08, 'sine', 0.06);
    osc(900, 0.05, 'sine', 0.04, 0.03);
  },
};

export type SoundName = keyof typeof sounds;

export function playSound(name: SoundName) {
  try {
    sounds[name]();
  } catch {
    // AudioContext not available (SSR, old browser) — silent fail
  }
}
