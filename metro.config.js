const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

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
    // the bundler's file crawler.
    blockList: [/specs\/.*/, /\.git\/.*/],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
