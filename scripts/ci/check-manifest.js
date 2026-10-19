#!/usr/bin/env node
/**
 * Release-manifest assertions from the 2026-10-19 security audit (SEC-08).
 *
 * Fails when a manifest:
 *   - declares the INTERNET permission (ADR-015: production has none),
 *   - has any exported component other than MainActivity (launcher + share
 *     target); a component with an intent-filter and no explicit
 *     `android:exported` counts as exported,
 *   - does not set `android:allowBackup="false"`.
 *
 * Run it on the merged release manifest, which includes every library's
 * additions, as well as on the source manifest:
 *
 *   node scripts/ci/check-manifest.js <path-to-AndroidManifest.xml> [...]
 */
/* eslint-disable no-console -- a CLI: printing results is its output. */
const fs = require('fs');

const ALLOWED_EXPORTED = /(^|\.)MainActivity$/;
// An exported component is acceptable when callers must hold one of these.
// `android.permission.DUMP` is granted only to the system and `adb shell`,
// never to an installed app. AndroidX's ProfileInstallReceiver (pulled into
// every merged manifest by the baseline-profile support in React Native and
// AndroidX) is exported behind it.
const GUARDING_PERMISSIONS = new Set(['android.permission.DUMP']);
const COMPONENT = /<(activity-alias|activity|service|receiver|provider)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g;

function attribute(attributes, name) {
  const match = new RegExp(`android:${name}\\s*=\\s*"([^"]*)"`).exec(attributes);
  return match ? match[1] : undefined;
}

function checkManifest(xml) {
  const problems = [];

  // `tools:node="remove"` on a permission means it is being stripped, not declared.
  const permissions = [...xml.matchAll(/<uses-permission\b([^>]*?)\/?>/g)];
  for (const [, attrs] of permissions) {
    if (attribute(attrs, 'name') === 'android.permission.INTERNET' && !/tools:node\s*=\s*"remove"/.test(attrs)) {
      problems.push('declares android.permission.INTERNET');
    }
  }

  for (const [, kind, attrs, body = ''] of xml.matchAll(COMPONENT)) {
    const name = attribute(attrs, 'name') || '(unnamed)';
    const exported = attribute(attrs, 'exported');
    const hasFilter = /<intent-filter\b/.test(body);
    const isExported = exported === 'true' || (exported === undefined && hasFilter);
    const guarded = GUARDING_PERMISSIONS.has(attribute(attrs, 'permission'));
    if (isExported && !guarded && !ALLOWED_EXPORTED.test(name)) {
      problems.push(`exported ${kind} ${name}`);
    }
  }

  const application = /<application\b([^>]*)>/.exec(xml);
  if (!application || attribute(application[1], 'allowBackup') !== 'false') {
    problems.push('android:allowBackup is not "false"');
  }

  return problems;
}

module.exports = {checkManifest};

if (require.main === module) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('usage: check-manifest.js <AndroidManifest.xml> [...]');
    process.exit(2);
  }
  let failed = false;
  for (const file of files) {
    const problems = checkManifest(fs.readFileSync(file, 'utf8'));
    if (problems.length === 0) {
      console.log(`ok   ${file}`);
    } else {
      failed = true;
      console.error(`FAIL ${file}`);
      problems.forEach(problem => console.error(`  - ${problem}`));
    }
  }
  process.exit(failed ? 1 : 0);
}
