const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

/** Either path separator, so a pattern behaves the same on Windows and Linux. */
const SEP = '[\\\\/]';
const escapeRegExp = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const joinSegments = segments => segments.map(escapeRegExp).join(SEP);
const rootSource = joinSegments(path.resolve(__dirname).split(/[\\/]/));

/** The directory made of literal [segments] directly under the repo root. */
const underRoot = (...segments) => new RegExp(`^${rootSource}${SEP}${joinSegments(segments)}${SEP}`);

/** The directory made of literal [segments] at any depth, node_modules included. */
const anywhere = (...segments) => new RegExp(`${SEP}${joinSegments(segments)}${SEP}`);

/**
 * Metro configuration.
 *
 * The `@/*` alias mirrors `compilerOptions.paths` in `tsconfig.json`. Keep the
 * two in sync; `npm run typecheck` will not catch a bundler-only drift.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    extraNodeModules: {
      '@': path.resolve(__dirname, 'src'),
    },
    // The spec pack and generated PDFs are large and must never be walked by
    // the bundler's file crawler. `android/(app/)?build` is Gradle/CMake/KSP
    // output — tens of thousands of churning files with every native build —
    // and was never excluded; Windows' native file watcher chokes on it
    // ("Failed to construct transformer: Failed to start watch mode"),
    // which is why Metro kept crashing/hanging after every `assembleDebug`.
    // `.claude/worktrees/**` is excluded wholesale, not just its own
    // build/.cxx/.gradle output: each worktree is a full separate checkout
    // (often with a concurrent Claude Code session actively building it),
    // and this tree's Metro has no legitimate reason to watch any of it —
    // when that other build deletes/recreates a directory mid-crawl, Metro's
    // watcher throws an unhandled ENOENT and takes the whole dev server down.
    // `.cxx` (CMake's own configure/build-temp directory) is a second,
    // separate gap the `android/build` entries above never covered: every
    // native dependency with its own CMake build
    // (`node_modules/<pkg>/android/.cxx/...`, not just this app's own
    // `android/.cxx/...`) churns one just as fast, and hit the exact same
    // unhandled-ENOENT crash the very first time a Gradle build ran
    // *concurrently* with Metro in this same tree. None of these patterns
    // are anchored to the repo root, so they match the equivalent path
    // anywhere it occurs, including inside `node_modules`.
    //
    // Two rules keep these patterns honest (see
    // scripts/ci/__tests__/metro-config.test.js):
    //  - Metro matches them against paths in the host's own format, `\` on
    //    Windows and `/` on Linux and macOS, so every separator below is
    //    `[\\/]`. A bare `/` silently matched nothing on Windows and
    //    everything on CI.
    //  - `specs` and `.claude/worktrees` are repo-root directories and are
    //    anchored there. The old unanchored `specs/` also matched
    //    `node_modules/react-native/Libraries/NativeModules/specs/`, which
    //    failed every Linux bundle ("Unable to resolve module
    //    ./Libraries/NativeModules/specs/NativeDialogManagerAndroid") while
    //    every Windows build passed. Build output, `.cxx` and `.git` are
    //    deliberately left to match anywhere, node_modules included.
    blockList: [
      underRoot('specs'),
      underRoot('.claude', 'worktrees'),
      anywhere('.git'),
      anywhere('android', 'build'),
      anywhere('android', 'app', 'build'),
      anywhere('android', '.gradle'),
      anywhere('.cxx'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
