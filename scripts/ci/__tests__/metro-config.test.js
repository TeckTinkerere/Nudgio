/**
 * @jest-environment node
 */

/**
 * Metro's `blockList` patterns are matched against paths that use the host's
 * separator: `\` on Windows, `/` on Linux and macOS. A pattern written with
 * only `/` therefore does nothing on a Windows machine and does too much on
 * CI. The old `/specs\/.*\/` was exactly that: unanchored, it matched React
 * Native's own `node_modules/react-native/Libraries/NativeModules/specs/`
 * on Linux, so every CI bundle failed with "Unable to resolve module
 * ./Libraries/NativeModules/specs/NativeDialogManagerAndroid" while every
 * local Windows build passed.
 *
 * These cases run both separator styles on whatever OS runs the test, so the
 * mistake cannot return unnoticed.
 */
const path = require('path');

const config = require('../../../metro.config');

const root = path.resolve(__dirname, '../../..');

const patterns = [].concat(config.resolver.blockList);

const asPosix = file => file.split(/[\\/]/).join('/');
const asWindows = file => file.split(/[\\/]/).join('\\');
const styles = [
  ['posix separators', asPosix],
  ['windows separators', asWindows],
];

const isBlocked = file => patterns.some(pattern => pattern.test(file));
const inRepo = (...segments) => [root, ...segments].join('/');

describe.each(styles)('Metro blockList with %s', (_name, convert) => {
  it.each([
    'node_modules/react-native/Libraries/NativeModules/specs/NativeDialogManagerAndroid.js',
    'node_modules/react-native/src/private/specs/modules/NativeAppState.js',
    'node_modules/some-package/specs/helper.js',
    'src/features/library/LibraryScreen.tsx',
    'src/native-client/NativeMediaReminder.ts',
    'index.js',
  ])('lets the bundler read %s', relative => {
    expect(isBlocked(convert(inRepo(relative)))).toBe(false);
  });

  it.each([
    'specs/Markdown/10_Backup_Export_and_Import_Specification.md',
    'specs/PDF/anything.pdf',
    'android/app/build/outputs/apk/debug/app-debug.apk',
    'android/build/reports/problems/problems-report.html',
    'android/.gradle/8.0/fileHashes/x.bin',
    'node_modules/react-native-screens/android/.cxx/Debug/abc/x86/CMakeCache.txt',
    'node_modules/react-native-video/android/build/intermediates/x.class',
    '.claude/worktrees/some-session/src/index.ts',
    '.git/HEAD',
  ])('keeps %s away from the file crawler', relative => {
    expect(isBlocked(convert(inRepo(relative)))).toBe(true);
  });
});
