/**
 * ESLint configuration.
 *
 * Beyond style, this file is where MR-07's dependency rules and MR-18's
 * architecture boundaries are mechanically enforced. A boundary that is only
 * written down in a spec drifts; a boundary that fails `npm run lint` does not.
 *
 * Layering (outer may import inner, never the reverse):
 *
 *   features  ->  design-system, native-client, core, localization
 *   design-system -> core/tokens-safe utilities only
 *   native-client -> core
 *   core      -> (nothing in this app)
 */
const RESTRICT_FEATURE_CROSS_IMPORT = {
  patterns: [
    {
      group: ['@/features/*/!(index)', '@/features/*/**'],
      message:
        'Import a feature only through its public index (e.g. "@/features/today"). Deep imports couple features to each other’s internals.',
    },
  ],
};

module.exports = {
  root: true,
  extends: ['@react-native', 'plugin:import/recommended', 'plugin:import/typescript'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      typescript: {project: './tsconfig.json'},
      node: {extensions: ['.js', '.jsx', '.ts', '.tsx']},
    },
  },
  ignorePatterns: [
    'node_modules/',
    'android/',
    'specs/',
    'coverage/',
    '*.config.js',
    'jest.setup*.js',
    '.eslintrc.js',
  ],
  rules: {
    'no-console': 'error',
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],
    'import/order': [
      'error',
      {
        groups: [['builtin', 'external'], 'internal', ['parent', 'sibling', 'index']],
        pathGroups: [{pattern: '@/**', group: 'internal'}],
        pathGroupsExcludedImportTypes: ['builtin'],
        'newlines-between': 'always',
        alphabetize: {order: 'asc', caseInsensitive: true},
      },
    ],
    'import/no-default-export': 'error',
    'import/no-cycle': ['error', {maxDepth: 4}],
    // MR-04: no isolated magic color or spacing values in product code.
    'react-native/no-color-literals': 'error',
    'react-native/no-inline-styles': 'warn',
    'react-native/no-unused-styles': 'error',
  },
  overrides: [
    {
      // `no-inline-styles` exists to catch a magic one-off style in screen
      // code (MR-04's "no isolated magic... values"). The design system and
      // the app chrome that themes itself directly (tab bar, providers) are
      // the opposite case: every style value here is a theme token computed
      // at render time because the theme itself is dynamic (light/dark,
      // Material You, RTL, reduced motion). Forcing those into
      // `StyleSheet.create` would not add safety, only indirection.
      files: [
        'src/design-system/**/*.{ts,tsx}',
        'src/app/navigation/**/*.{ts,tsx}',
        'src/app/AppProviders.tsx',
      ],
      rules: {
        'react-native/no-inline-styles': 'off',
      },
    },
    {
      // RGB channel packing/unpacking is the one place bitwise operators are
      // the correct, standard tool — the alternative (integer division and
      // modulo) is less clear, not more.
      files: ['src/design-system/theme/colorUtils.ts'],
      rules: {
        'no-bitwise': 'off',
      },
    },
    {
      // Typed rules require `@typescript-eslint/parser`, which plain `.js`
      // config files in this repo (babel.config.js, metro.config.js, ...) do
      // not use. Scoping to `.ts`/`.tsx` keeps `no-explicit-any` and
      // `consistent-type-imports` off files that have no type information to
      // check in the first place.
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          {prefer: 'type-imports', fixStyle: 'inline-type-imports'},
        ],
      },
    },
    {
      // MR-07 rule 1: React features depend on the generated native client,
      // never on Android classes or the raw NativeModules registry.
      files: ['src/features/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': ['error', RESTRICT_FEATURE_CROSS_IMPORT],
      },
    },
    {
      // The design system is a leaf. It knows about tokens and React, not about
      // repositories, the bridge or any feature.
      files: ['src/design-system/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: [
                  '@/features/**',
                  '@/native-client/**',
                  '@/core/repositories/**',
                  '@/core/services/**',
                ],
                message:
                  'The design system must stay presentational. Pass data in via props instead of reaching for a repository, service or the native bridge.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['src/core/**/*.{ts,tsx}'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/features/**', '@/design-system/**'],
                message:
                  'Core is the innermost layer. It must not depend on UI or on a feature.',
              },
            ],
          },
        ],
      },
    },
    {
      // Only the native client may touch the TurboModule registry directly.
      files: ['src/**/*.{ts,tsx}'],
      excludedFiles: ['src/native-client/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: 'react-native',
                importNames: ['NativeModules', 'TurboModuleRegistry'],
                message:
                  'Go through "@/native-client". Direct module access bypasses the typed contract, error envelope and mock used in tests.',
              },
            ],
          },
        ],
      },
    },
    {
      files: ['**/*.test.{ts,tsx}', 'src/testing/**/*.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'react-native/no-inline-styles': 'off',
        'react-native/no-color-literals': 'off',
      },
    },
  ],
};
