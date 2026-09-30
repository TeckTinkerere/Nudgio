// Deterministic, original PCM tone. No network, external audio, or codec dependency.
const fs = require('node:fs');
const path = require('node:path');
const rate = 22050;
const samples = rate * 2;
const wav = Buffer.alloc(44 + samples * 2);
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(rate, 24); wav.writeUInt32LE(rate * 2, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++) {
  const t = i / rate;
  const pulse = t % 0.75;
  const envelope = pulse < 0.4 ? Math.min(pulse / 0.025, (0.4 - pulse) / 0.08, 1) : 0;
  const fade = Math.min(1, (2 - t) / 0.1);
  wav.writeInt16LE(Math.round(9000 * envelope * fade * Math.sin(2 * Math.PI * 660 * t)), 44 + i * 2);
}
const output = path.resolve(__dirname, '../android/app/src/main/res/raw/nudgio_alarm.wav');
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.writeFileSync(output, wav);
console.log(`Generated original fallback tone: ${wav.length} bytes`);
