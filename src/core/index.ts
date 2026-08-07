/**
 * Core layer public surface.
 *
 * The innermost layer (see the ESLint boundary rule): it depends on nothing
 * in `features` or `design-system`. Everything else in the app may depend on
 * it.
 */
export * from './config/appConfig';
export * from './config/featureFlags';
export * from './errors';
export * from './logging';
export * from './repositories';
export * from './result/Result';
export * from './services';
export * from './state';
export * from './storage';
