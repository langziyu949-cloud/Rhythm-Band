const fs = require('node:fs');
const path = require('node:path');

const sampleRate = 44100;
const bpm = 120;
const beat = 60 / bpm;
const eighth = beat / 2;
const duration = 30;
const frames = Math.floor(sampleRate * duration);
const mix = new Float32Array(frames);

function add(start, seconds, render) {
  const from = Math.max(0, Math.floor(start * sampleRate));
  const to = Math.min(frames, Math.ceil((start + seconds) * sampleRate));
  for (let i = from; i < to; i++) {
    const t = (i - from) / sampleRate;
    mix[i] += render(t, seconds);
  }
}

function kick(t, gain = 0.55) {
  add(t, 0.18, (x) => {
    const f = 150 * Math.exp(-x * 28) + 46;
    const env = Math.exp(-x * 20);
    return Math.sin(2 * Math.PI * f * x) * env * gain;
  });
}

function clap(t, gain = 0.16) {
  add(t, 0.12, (x) => {
    const seed = Math.sin((x + t) * 12893.17) * 43758.5453;
    const noise = (seed - Math.floor(seed)) * 2 - 1;
    return noise * Math.exp(-x * 36) * gain;
  });
}

function bass(t, freq, gain = 0.23) {
  add(t, 0.38, (x) => {
    const env = Math.min(1, x * 40) * Math.exp(-x * 6);
    const wave = Math.sin(2 * Math.PI * freq * x) + 0.22 * Math.sin(4 * Math.PI * freq * x);
    return wave * env * gain;
  });
}

function mallet(t, freq, gain = 0.16, length = 0.22) {
  add(t, length, (x) => {
    const env = Math.exp(-x * 15);
    const wave = Math.sin(2 * Math.PI * freq * x) + 0.32 * Math.sin(2 * Math.PI * freq * 2.01 * x);
    return wave * env * gain;
  });
}

function woodblock(t, gain = 0.18) {
  add(t, 0.07, (x) => {
    const env = Math.exp(-x * 65);
    return (Math.sin(2 * Math.PI * 1850 * x) + 0.45 * Math.sin(2 * Math.PI * 2720 * x)) * env * gain;
  });
}

function stamp(t, gain = 0.28) {
  add(t, 0.14, (x) => {
    const body = Math.sin(2 * Math.PI * (105 - x * 260) * x) * Math.exp(-x * 24);
    const click = Math.sin(2 * Math.PI * 2300 * x) * Math.exp(-x * 90) * 0.45;
    return (body + click) * gain;
  });
}

function finalChord(t) {
  [261.63, 329.63, 392.0, 523.25].forEach((freq, index) => {
    add(t, 0.48, (x) => Math.sin(2 * Math.PI * freq * x) * Math.exp(-x * 4.8) * (0.12 - index * 0.008));
  });
}

const notePool = [523.25, 587.33, 659.25, 783.99, 659.25, 587.33];
const roots = [130.81, 130.81, 174.61, 196.0, 174.61, 130.81, 196.0, 174.61];
const patterns = [
  'intro', 'A', 'A', 'A', 'B', 'A', 'B', 'B',
  'A', 'B', 'A', 'A', 'B', 'B', 'B',
];

patterns.forEach((pattern, bar) => {
  const start = bar * 4 * beat;
  const root = roots[bar % roots.length];

  // A clear, simple four-on-the-floor delivery groove.
  kick(start, 0.5);
  kick(start + 2 * beat, 0.42);
  clap(start + beat, 0.13);
  clap(start + 3 * beat, 0.15);
  bass(start, root);
  bass(start + 2 * beat, root * 1.5, 0.19);

  if (pattern === 'intro') {
    mallet(start + eighth * 2, notePool[0], 0.11);
    mallet(start + eighth * 5, notePool[2], 0.11);
    return;
  }

  const cues = pattern === 'A' ? [0, 2] : [0, 1, 2];
  const stamps = pattern === 'A' ? [4] : [4, 6];

  cues.forEach((slot, index) => {
    woodblock(start + slot * eighth, 0.15 + index * 0.015);
    mallet(start + slot * eighth, notePool[(bar + slot) % notePool.length], 0.075, 0.16);
  });
  stamps.forEach((slot, index) => {
    // Quiet in the backing track: in-game input SFX can sit on top of this transient.
    stamp(start + slot * eighth, 0.16 + index * 0.02);
    mallet(start + slot * eighth + 0.025, notePool[(bar + 3 + index) % notePool.length], 0.075, 0.16);
  });

  if (bar === patterns.length - 1) finalChord(start + 6 * eighth);
});

let peak = 0;
for (const sample of mix) peak = Math.max(peak, Math.abs(sample));
const normalise = peak > 0 ? 0.82 / peak : 1;
const bytes = Buffer.alloc(44 + frames * 2);
bytes.write('RIFF', 0);
bytes.writeUInt32LE(36 + frames * 2, 4);
bytes.write('WAVE', 8);
bytes.write('fmt ', 12);
bytes.writeUInt32LE(16, 16);
bytes.writeUInt16LE(1, 20);
bytes.writeUInt16LE(1, 22);
bytes.writeUInt32LE(sampleRate, 24);
bytes.writeUInt32LE(sampleRate * 2, 28);
bytes.writeUInt16LE(2, 32);
bytes.writeUInt16LE(16, 34);
bytes.write('data', 36);
bytes.writeUInt32LE(frames * 2, 40);
for (let i = 0; i < frames; i++) {
  const value = Math.max(-1, Math.min(1, mix[i] * normalise));
  bytes.writeInt16LE(Math.round(value * 32767), 44 + i * 2);
}

const output = path.resolve(__dirname, '../assets/audio/stamp-station-demo.wav');
fs.writeFileSync(output, bytes);
console.log(output);
