#!/usr/bin/env node
/**
 * Generates SHA256SUMS.txt for a directory of release assets (MR-20 "Release
 * assets" / "Calculate SHA-256 for every public artifact"). Same line format
 * as `specs/SHA256SUMS.txt` and the app's own backup-archive checksums
 * (`BackupChecksums.formatLine`): `<hex>  <relative-path>\n`, `sha256sum`-
 * compatible so a release can be verified with common tools, not just this
 * script.
 *
 * Usage:
 *   node scripts/release/checksums.js <dir> [outFile]
 *
 * outFile defaults to `<dir>/SHA256SUMS.txt`. Non-recursive: MR-20's release
 * assets (APK(s), the checksum file itself, changelog, etc.) live flat in
 * one release directory.
 */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function fail(message) {
  process.stderr.write(`checksums: ${message}\n`);
  process.exit(1);
}

function sha256Hex(filePath) {
  const digest = crypto.createHash('sha256');
  digest.update(fs.readFileSync(filePath));
  return digest.digest('hex');
}

function main() {
  const [, , dirArg, outFileArg] = process.argv;
  if (!dirArg) {
    fail('usage: node scripts/release/checksums.js <dir> [outFile]');
  }

  const dir = path.resolve(dirArg);
  if (!fs.statSync(dir).isDirectory()) {
    fail(`${dir} is not a directory`);
  }

  const outFile = outFileArg ? path.resolve(outFileArg) : path.join(dir, 'SHA256SUMS.txt');
  const outFileName = path.basename(outFile);

  const entries = fs
    .readdirSync(dir, {withFileTypes: true})
    .filter((entry) => entry.isFile() && entry.name !== outFileName)
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (entries.length === 0) {
    fail(`no files found in ${dir}`);
  }

  const lines = entries.map((name) => `${sha256Hex(path.join(dir, name))}  ${name}\n`);
  fs.writeFileSync(outFile, lines.join(''), 'utf8');

  process.stdout.write(`Wrote ${entries.length} checksum(s) to ${outFile}\n`);
}

main();
