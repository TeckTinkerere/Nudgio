const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const reports = path.join(root, 'android/app/build/test-results/testDebugUnitTest');
const totals = {suites: 0, tests: 0, failures: 0, errors: 0, skipped: 0};
for (const name of fs.readdirSync(reports).filter(name => /^TEST-.*\.xml$/.test(name))) {
  const xml = fs.readFileSync(path.join(reports, name), 'utf8');
  const header = xml.match(/<testsuite\s[^>]+>/)?.[0];
  if (!header) throw new Error(`Invalid report: ${name}`);
  totals.suites++;
  for (const key of ['tests', 'failures', 'errors', 'skipped']) {
    totals[key] += Number(header.match(new RegExp(`${key}="(\\d+)"`))?.[1] ?? 0);
  }
}
if (!totals.tests || totals.failures || totals.errors || totals.skipped) throw new Error(JSON.stringify(totals));
const manifestPath = path.join(root, 'android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml');
const fallbackPath = path.join(root, 'android/app/build/intermediates/merged_manifest/release/processReleaseMainManifest/AndroidManifest.xml');
// Main-manifest task is deliberately used without packaging an APK.
const selectedPath = fs.existsSync(fallbackPath) ? fallbackPath : manifestPath;
const manifest = fs.readFileSync(selectedPath, 'utf8');
const permissions = [...manifest.matchAll(/<uses-permission[^>]+android:name="([^"]+)"/g)].map(match => match[1]);
for (const denied of ['INTERNET', 'SYSTEM_ALERT_WINDOW', 'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS', 'READ_MEDIA_IMAGES', 'READ_EXTERNAL_STORAGE']) {
  if (permissions.includes(`android.permission.${denied}`)) throw new Error(`Forbidden permission: ${denied}`);
}
const source = fs.readFileSync(path.join(root, 'assets/brand/nudgio-logo.jpg'));
const drawable = fs.readFileSync(path.join(root, 'android/app/src/main/res/drawable-nodpi/nudgio_logo.jpg'));
if (!source.equals(drawable)) throw new Error('Artwork copies differ');
const sha256 = crypto.createHash('sha256').update(source).digest('hex');
if (sha256 !== '2876accf958c3a5053e0dbdd2ae481d5443879031caf3c869361dc39111e5d51') throw new Error('Artwork changed');
console.log(JSON.stringify({nativeTests: totals, releaseManifest: selectedPath, manifestModified: fs.statSync(selectedPath).mtime.toISOString(), permissions, logoBytes: source.length, sha256}, null, 2));
