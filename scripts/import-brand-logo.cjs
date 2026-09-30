// Copy the approved artwork without decoding, resizing, or re-encoding it.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const source = process.argv[2];
if (!source) throw new Error('Provide the approved logo JPEG path.');
const bytes = fs.readFileSync(source);
if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Expected JPEG artwork.');
const root = path.resolve(__dirname, '..');
const destinations = [
  'assets/brand/nudgio-logo.jpg',
  'android/app/src/main/res/drawable-nodpi/nudgio_logo.jpg',
];
for (const relative of destinations) {
  const destination = path.join(root, relative);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.writeFileSync(destination, bytes);
  if (!fs.readFileSync(destination).equals(bytes)) throw new Error('Copy mismatch');
}
console.log(JSON.stringify({bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), destinations}));
