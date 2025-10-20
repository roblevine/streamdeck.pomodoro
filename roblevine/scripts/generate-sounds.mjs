#!/usr/bin/env node
// Generates CC0 WAV assets at the plugin assets path.
// No dependencies; plain Node ESM.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateDoublePip({
  sampleRate = 44100,
  frequency = 880,
  pipMs = 90,
  gapMs = 120,
  pip2Ms = 110,
  amplitude = 0.3,
} = {}) {
  const pipSamples1 = Math.round(sampleRate * (pipMs / 1000));
  const gapSamples = Math.round(sampleRate * (gapMs / 1000));
  const pipSamples2 = Math.round(sampleRate * (pip2Ms / 1000));
  const totalSamples = pipSamples1 + gapSamples + pipSamples2;
  const data = new Int16Array(totalSamples);

  const twoPiFDivSR = (2 * Math.PI * frequency) / sampleRate;
  const amp = Math.max(0, Math.min(1, amplitude)) * 0.95; // safety headroom

  // Simple cosine-squared fade-in/out envelope to avoid clicks
  const makeEnv = (n) => {
    const env = new Float32Array(n);
    const fade = Math.min(0.01, (n / sampleRate) * 0.2); // up to 10ms or 20% of duration
    const fadeSamples = Math.max(1, Math.round(n * fade));
    for (let i = 0; i < n; i++) {
      let e = 1;
      if (i < fadeSamples) {
        const t = i / fadeSamples;
        e = Math.sin((Math.PI / 2) * t) ** 2;
      } else if (i > n - fadeSamples) {
        const t = (n - i) / fadeSamples;
        e = Math.sin((Math.PI / 2) * t) ** 2;
      }
      env[i] = e;
    }
    return env;
  };

  const env1 = makeEnv(pipSamples1);
  for (let i = 0; i < pipSamples1; i++) {
    const s = Math.sin(i * twoPiFDivSR) * amp * env1[i];
    data[i] = Math.max(-1, Math.min(1, s)) * 0x7fff;
  }
  // gap is zeros by default
  const start2 = pipSamples1 + gapSamples;
  const env2 = makeEnv(pipSamples2);
  for (let i = 0; i < pipSamples2; i++) {
    const s = Math.sin(i * twoPiFDivSR) * amp * env2[i];
    data[start2 + i] = Math.max(-1, Math.min(1, s)) * 0x7fff;
  }

  return { sampleRate, channels: 1, bitsPerSample: 16, samples: data };
}

function generateKeyClick({
  sampleRate = 44100,
  durationMs = 35,
  f1 = 1800,
  f2 = 3000,
  amplitude = 0.35,
} = {}) {
  const total = Math.max(1, Math.round(sampleRate * (durationMs / 1000)));
  const data = new Int16Array(total);
  const twoPiF1 = (2 * Math.PI * f1) / sampleRate;
  const twoPiF2 = (2 * Math.PI * f2) / sampleRate;
  const amp = Math.max(0, Math.min(1, amplitude)) * 0.9;
  for (let i = 0; i < total; i++) {
    const t = i / total;
    // Exponential decay envelope for clicky transient
    const env = Math.exp(-12 * t);
    const s = (Math.sin(i * twoPiF1) + 0.6 * Math.sin(i * twoPiF2)) * amp * env;
    data[i] = Math.max(-1, Math.min(1, s)) * 0x7fff;
  }
  return { sampleRate, channels: 1, bitsPerSample: 16, samples: data };
}

function generateSilent({
  sampleRate = 44100,
  durationMs = 12,
} = {}) {
  const total = Math.max(1, Math.round(sampleRate * (durationMs / 1000)));
  const data = new Int16Array(total); // zeros = silence
  return { sampleRate, channels: 1, bitsPerSample: 16, samples: data };
}

function toWavBytes({ sampleRate, channels, bitsPerSample, samples }) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const dataByteLength = samples.length * 2; // 16-bit
  const buffer = new ArrayBuffer(44 + dataByteLength);
  const view = new DataView(buffer);
  let o = 0;
  function writeStr(s) { for (let i = 0; i < s.length; i++) view.setUint8(o++, s.charCodeAt(i)); }
  function write32(v) { view.setUint32(o, v, true); o += 4; }
  function write16(v) { view.setUint16(o, v, true); o += 2; }

  // RIFF header
  writeStr('RIFF');
  write32(36 + dataByteLength);
  writeStr('WAVE');
  // fmt chunk
  writeStr('fmt ');
  write32(16); // PCM
  write16(1); // PCM format
  write16(channels);
  write32(sampleRate);
  write32(byteRate);
  write16(blockAlign);
  write16(bitsPerSample);
  // data chunk
  writeStr('data');
  write32(dataByteLength);
  // PCM data
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(o, samples[i], true);
    o += 2;
  }
  return Buffer.from(buffer);
}

function main() {
  const outDir = path.resolve(__dirname, '..', 'uk.co.roblevine.streamdeck.pomodoro.sdPlugin', 'assets', 'sounds');
  fs.mkdirSync(outDir, { recursive: true });

  const doublePipPath = path.join(outDir, 'reset-double-pip.wav');
  if (fs.existsSync(doublePipPath)) {
    console.log(`Exists, skipping generation: ${doublePipPath}`);
  } else {
    const wav = generateDoublePip();
    const bytes = toWavBytes(wav);
    fs.writeFileSync(doublePipPath, bytes);
    console.log(`Generated: ${doublePipPath} (${bytes.length} bytes)`);
  }

  const clickPath = path.join(outDir, 'key-click.wav');
  if (fs.existsSync(clickPath)) {
    console.log(`Exists, skipping generation: ${clickPath}`);
  } else {
    const click = generateKeyClick();
    const clickBytes = toWavBytes(click);
    fs.writeFileSync(clickPath, clickBytes);
    console.log(`Generated: ${clickPath} (${clickBytes.length} bytes)`);
  }

  const primePath = path.join(outDir, 'silent-prime.wav');
  if (fs.existsSync(primePath)) {
    console.log(`Exists, skipping generation: ${primePath}`);
  } else {
    const silent = generateSilent();
    const silentBytes = toWavBytes(silent);
    fs.writeFileSync(primePath, silentBytes);
    console.log(`Generated: ${primePath} (${silentBytes.length} bytes)`);
  }
}

main();
