import * as fs from 'fs';
import * as path from 'path';

const SAMPLE_RATE = 44100;
const outDir = path.join(__dirname, '..', 'public', 'sounds');

function writeWav(filePath: string, samples: Float64Array, sampleRate: number) {
  const numSamples = samples.length;
  const bitsPerSample = 16;
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * (bitsPerSample / 8);
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;

  // RIFF header
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(fileSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;

  // fmt chunk
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // chunk size
  buffer.writeUInt16LE(1, offset); offset += 2;  // PCM
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

  // data chunk
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const intVal = clamped < 0 ? clamped * 0x8000 : clamped * 0x7FFF;
    buffer.writeInt16LE(Math.round(intVal), offset);
    offset += 2;
  }

  fs.writeFileSync(filePath, buffer);
  console.log(`  -> ${path.basename(filePath)} (${numSamples} samples, ${(numSamples / sampleRate * 1000).toFixed(0)}ms)`);
}

// --- Click sound: short percussive pop ---
function generateClick(): Float64Array {
  const duration = 0.05; // 50ms
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const noise = Math.random() * 2 - 1;
    const envelope = Math.exp(-t * 120); // fast exponential decay
    samples[i] = noise * envelope * 0.6;
  }

  return samples;
}

// --- Type sound: softer, higher-freq key tap ---
function generateType(): Float64Array {
  const duration = 0.03; // 30ms
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const noise = Math.random() * 2 - 1;
    // High-pass effect: use difference of consecutive noise
    const hpNoise = i > 0 ? noise - (Math.random() * 2 - 1) : noise;
    const envelope = Math.exp(-t * 200); // very fast decay
    samples[i] = hpNoise * envelope * 0.3;
  }

  return samples;
}

// --- Whoosh sound: frequency sweep ---
function generateWhoosh(): Float64Array {
  const duration = 0.3; // 300ms
  const numSamples = Math.floor(SAMPLE_RATE * duration);
  const samples = new Float64Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const progress = t / duration;
    // Frequency sweep from 400Hz down to 200Hz
    const freq = 400 - 200 * progress;
    const phase = 2 * Math.PI * freq * t;
    const sine = Math.sin(phase);
    const noise = (Math.random() * 2 - 1) * 0.3;
    // Bell-shaped envelope: peaks at 30% through
    const envelope = Math.sin(Math.PI * progress) * Math.exp(-progress * 2);
    samples[i] = (sine * 0.5 + noise) * envelope * 0.4;
  }

  return samples;
}

// --- Main ---
console.log('Generating sound effects...');
fs.mkdirSync(outDir, { recursive: true });

writeWav(path.join(outDir, 'click.wav'), generateClick(), SAMPLE_RATE);
writeWav(path.join(outDir, 'type.wav'), generateType(), SAMPLE_RATE);
writeWav(path.join(outDir, 'whoosh.wav'), generateWhoosh(), SAMPLE_RATE);

console.log('Done!');
