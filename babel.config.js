/**
 * Babel configuration.
 *
 * `module-resolver` is deliberately NOT used. Path aliases are declared once in
 * `tsconfig.json` and resolved by Metro (see `metro.config.js`), so there is a
 * single source of truth for `@/*` and no chance of tsc and the bundler
 * disagreeing about what a path means.
 *
 * No `plugins` entry: the app has no `react-native-reanimated` worklets (or
 * any other Babel-plugin-requiring library) to rewrite — animation goes
 * through plain `react-native` `Animated` (see `src/app/InAppDueCard.tsx`).
 * A dependency-only entry here would run its transform over every file in
 * the project for zero benefit (docs/decision-log.md).
 */
module.exports = {
  presets: ['@react-native/babel-preset'],
};
