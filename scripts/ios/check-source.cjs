'use strict';

// Configuration preflight only. This does not parse Swift or prove AlarmKit works.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const ios = path.join(root, 'ios');
const project = JSON.parse(fs.readFileSync(path.join(ios, 'project.json'), 'utf8'));
const app = project.targets.NudgioFeasibility;
const widget = project.targets.NudgioCountdown;
assert.equal(project.options.deploymentTarget.iOS, '26.0');
assert.equal(app.platform, 'iOS');
assert.equal(app.type, 'application');
assert.equal(widget.type, 'app-extension');
assert.equal(app.info.properties.NSSupportsLiveActivities, true);
assert.ok(app.info.properties.NSAlarmKitUsageDescription.length > 20);
assert.ok(app.dependencies.some(item => item.target === 'NudgioCountdown' && item.embed));
assert.ok(widget.settings.base.PRODUCT_BUNDLE_IDENTIFIER.startsWith(app.settings.base.PRODUCT_BUNDLE_IDENTIFIER + '.'));
assert.ok(project.schemes.NudgioFeasibility.test.targets.includes('NudgioFeasibilityTests'));
assert.ok(app.sources.includes('Shared') && widget.sources.includes('Shared'));
for (const target of Object.values(project.targets)) {
  for (const folder of target.sources) {
    assert.ok(fs.statSync(path.join(ios, folder)).isDirectory(), `Missing source directory: ${folder}`);
  }
  assert.equal(target.entitlements, undefined, 'Review any newly introduced entitlement in an ADR.');
  assert.equal(target.info?.properties.UIBackgroundModes, undefined, 'No background delivery modes.');
}
const swiftFiles = ['Feasibility', 'Shared', 'Countdown', 'Tests'].flatMap(folder =>
  fs.readdirSync(path.join(ios, folder)).filter(name => name.endsWith('.swift')).map(name => `${folder}/${name}`));
const swift = swiftFiles.map(file => fs.readFileSync(path.join(ios, file), 'utf8')).join('\n');
assert.ok(!/import (CloudKit|UserNotifications|React|AVFoundation)|URLSession|Timer\.scheduledTimer/.test(swift),
  'Unexpected runtime/network/background dependency. Review the iPhone scope.');
const privacy = fs.readFileSync(path.join(ios, 'Shared/PrivacyInfo.xcprivacy'), 'utf8');
assert.match(privacy, /<key>NSPrivacyTracking<\/key><false\/>/);
assert.match(privacy, /<key>NSPrivacyCollectedDataTypes<\/key><array\/>/);
const testCount = (swift.match(/func test[A-Z]\w*\(/g) || []).length;
assert.ok(testCount >= 16, 'Native behavioural test sources must remain included.');
process.stdout.write(`PASS: iOS configuration, source membership and privacy guards; ${swiftFiles.length} Swift files, ${testCount} native tests authored.\n`);
process.stdout.write('NOT VERIFIED: Swift compilation, XCTest execution, signing, simulator or physical-device behaviour.\n');
