module.exports = {
  project: {
    android: {
      sourceDir: './android',
    },
  },
  // ADR-022: ios/ currently contains a standalone native feasibility target,
  // not a React Native app. Build it using ios/README.md; do not run it through
  // the React Native CLI. The production RN iPhone shell follows device gate G1.
  assets: [],
};
