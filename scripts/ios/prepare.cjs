'use strict';

const {spawnSync} = require('node:child_process');
const path = require('node:path');

if (process.platform !== 'darwin') {
  process.stderr.write('iPhone builds require macOS with Xcode. Source files are ready; no project or build was generated.\n');
  process.exitCode = 1;
} else {
  const root = path.resolve(__dirname, '../..');
  const checked = spawnSync(process.execPath, [path.join(__dirname, 'check-source.cjs')], {stdio: 'inherit'});
  if (checked.status !== 0) {
    process.exitCode = checked.status || 1;
  } else {
    const result = spawnSync('xcodegen', ['generate', '--spec', 'ios/project.json'], {cwd: root, stdio: 'inherit'});
    if (result.error) {
      process.stderr.write('XcodeGen was not available. Install XcodeGen 2.44+ on the Mac and run this command again.\n');
    }
    process.exitCode = result.status ?? 1;
  }
}
