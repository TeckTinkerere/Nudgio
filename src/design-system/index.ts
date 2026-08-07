/**
 * Design system public surface (MR-04).
 *
 * Features import from here and nothing deeper. The folder is a leaf layer:
 * it never reaches for a repository, a service or the native bridge — see the
 * boundary rule in `.eslintrc.js`.
 */
export * from './tokens';
export * from './theme';
export * from './icons';
export * from './layout';
export * from './components';
