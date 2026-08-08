/**
 * Babel configuration.
 *
 * `module-resolver` is deliberately NOT used. Path aliases are declared once in
 * `tsconfig.json` and resolved by Metro (see `metro.config.js`), so there is a
 * single source of truth for `@/*` and no chance of tsc and the bundler
 * disagreeing about what a path means.
 *
 * `react-native-reanimated/plugin` (a thin re-export of
 * `react-native-worklets/plugin` in Reanimated 4) rewrites `worklet`-tagged
 * functions to run on the UI thread — required for any `useAnimatedStyle`/
 * `withSpring`/`withTiming` call to work at all, not an optional perf
 * add-on. Per Reanimated's own docs this MUST be the last plugin in the list.
 */
module.exports = {
  presets: ['@react-native/babel-preset'],
  plugins: ['react-native-reanimated/plugin'],
};
