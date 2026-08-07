module.exports = {
  project: {
    android: {
      sourceDir: './android',
    },
  },
  // ADR-002: Android-only v1. No `ios/` directory exists, and none is
  // created — the CLI's iOS platform plugin (bundled in
  // @react-native-community/cli by default) finds nothing to detect and
  // iOS commands are simply unavailable. Older CLI versions accepted an
  // explicit `platforms: { ios: null }` here to suppress iOS probing, but
  // the current config schema requires each `platforms` entry to be a real
  // plugin-descriptor object, not `null` — this key doesn't exist for that
  // reason, not by oversight.
  assets: [],
};
