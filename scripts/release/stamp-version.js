#!/usr/bin/env node
/**
 * Stamps android/version.properties (MR-20). versionCode must only ever
 * increase — Android's upgrade identity depends on it, and there is no way
 * to walk it back after a release ships (see docs/decision-log.md and
 * specs/Markdown/20_Release_Distribution_Portfolio_and_Maintenance_Guide.md
 * "Upgrade and rollback").
 *
 * Usage:
 *   node scripts/release/stamp-version.js <versionName> [versionCode]
 *
 * versionCode defaults to (current versionCode + 1) when omitted. Passing it
 * explicitly is only for recovering a skipped/aborted release's numbering —
 * it must still be greater than the current value.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const VERSION_PROPERTIES_PATH = path.join(__dirname, '..', '..', 'android', 'version.properties');
const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

function readVersionProperties(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const props = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }
    props[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim();
  }
  return props;
}

function compareSemver(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return 0;
}

function fail(message) {
  process.stderr.write(`stamp-version: ${message}\n`);
  process.exit(1);
}

function main() {
  const [, , versionNameArg, versionCodeArg] = process.argv;
  if (!versionNameArg) {
    fail('usage: node scripts/release/stamp-version.js <versionName> [versionCode]');
  }

  const match = SEMVER_PATTERN.exec(versionNameArg);
  if (!match) {
    fail(`versionName "${versionNameArg}" is not a plain X.Y.Z semantic version`);
  }
  const nextVersionParts = [Number(match[1]), Number(match[2]), Number(match[3])];

  const current = readVersionProperties(VERSION_PROPERTIES_PATH);
  const currentVersionCode = Number.parseInt(current.versionCode, 10);
  const currentVersionName = current.versionName || '';
  const currentMatch = SEMVER_PATTERN.exec(currentVersionName);
  const currentVersionParts = currentMatch
    ? [Number(currentMatch[1]), Number(currentMatch[2]), Number(currentMatch[3])]
    : [0, 0, 0];

  if (compareSemver(nextVersionParts, currentVersionParts) <= 0) {
    fail(
      `versionName ${versionNameArg} must be strictly greater than the current ${currentVersionName}`,
    );
  }

  let nextVersionCode;
  if (versionCodeArg !== undefined) {
    nextVersionCode = Number.parseInt(versionCodeArg, 10);
    if (!Number.isInteger(nextVersionCode)) {
      fail(`versionCode "${versionCodeArg}" is not an integer`);
    }
  } else {
    nextVersionCode = currentVersionCode + 1;
  }
  if (nextVersionCode <= currentVersionCode) {
    fail(`versionCode ${nextVersionCode} must be strictly greater than the current ${currentVersionCode}`);
  }

  const contents = `# Stamped by \`scripts/release/stamp-version.js\` (MR-20). Do not hand-edit
# except to recover from an aborted release — versionCode must only ever
# increase (Android upgrade identity depends on it).
versionCode=${nextVersionCode}
versionName=${versionNameArg}
`;
  fs.writeFileSync(VERSION_PROPERTIES_PATH, contents, 'utf8');

  process.stdout.write(
    `Stamped android/version.properties: versionName ${currentVersionName} -> ${versionNameArg}, versionCode ${currentVersionCode} -> ${nextVersionCode}\n`,
  );
}

main();
