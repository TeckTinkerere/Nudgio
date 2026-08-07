/**
 * Dependency injection container.
 *
 * There is no DI framework/decorator magic here on purpose: every dependency
 * in this app is an interface plus a factory function, and "injection" is
 * passing the right factory's output into the next one. A framework would add
 * indirection without adding a capability this file doesn't already have.
 *
 * `AppContainer` is the one object that knows how every piece is wired. A
 * screen never constructs a repository or a service — it receives them from
 * `AppProvidersContext` (`src/app/AppProviders.tsx`), which is built from this
 * container. Tests build an alternate container with fakes via
 * `createTestContainer` in `src/testing`.
 */
import type {QueryClient} from '@tanstack/react-query';

import {resolveBuildVariant, type FeatureFlags} from '../../core/config/featureFlags';
import {featureFlagsFor} from '../../core/config/featureFlags';
import {createConsoleLogger, createNoopLogger, type Logger} from '../../core/logging';
import {createRepositories, type Repositories} from '../../core/repositories';
import {
  createAppearanceService,
  createIdGenerator,
  createSystemClock,
  createSystemHaptics,
  type AppearanceService,
  type ClockService,
  type HapticsService,
  type IdGenerator,
} from '../../core/services';
import {createQueryClient} from '../../core/state';
import {
  createInMemoryKeyValueStore,
  createNativePreferencesStore,
  type KeyValueStore,
  type PreferencesStore,
} from '../../core/storage';
import {
  createMediaReminderClient,
  type MediaReminderClient,
} from '../../native-client';

export interface AppContainer {
  readonly logger: Logger;
  readonly flags: FeatureFlags;
  readonly ids: IdGenerator;
  readonly clock: ClockService;
  readonly haptics: HapticsService;
  readonly client: MediaReminderClient;
  readonly repositories: Repositories;
  readonly preferences: PreferencesStore;
  readonly appearance: AppearanceService;
  readonly viewState: KeyValueStore;
  readonly queryClient: QueryClient;
}

export interface CreateAppContainerOptions {
  /** Reported by the native module once available; `undefined` before startup. */
  readonly reportedBuildVariant?: string;
  /** Reported by the native module; defaults to a safe pre-dynamic-color value. */
  readonly apiLevel?: number;
}

export const createAppContainer = (
  options: CreateAppContainerOptions = {},
): AppContainer => {
  const variant = resolveBuildVariant(options.reportedBuildVariant);
  const flags = featureFlagsFor(variant);

  const logger = flags.verboseLogging ? createConsoleLogger() : createNoopLogger();
  const ids = createIdGenerator();
  const clock = createSystemClock();
  const haptics = createSystemHaptics();

  // Dev-only screen-building convenience: if no Kotlin module answered
  // `TurboModuleRegistry.get()` (Metro-only preview, or before the native
  // build is wired), install one seeded with realistic mock data instead of
  // leaving every screen on its empty state. A real registered module is
  // never displaced by this — see `demoNativeModule.ts`'s module doc — and
  // `__DEV__` is false in every release build, so this branch cannot run
  // there regardless.
  //
  // `require()`, not a static top-level `import`: an ES import is hoisted
  // and evaluated unconditionally regardless of this `if`, which would pull
  // `demoNativeModule.ts` (and the full mock reminder/media dataset it
  // seeds from `mocks/fixtures.ts`) into every build's module graph. A
  // `require()` call gated behind `__DEV__` at least keeps this specific
  // call site's cost out of release execution (docs/decision-log.md — the
  // *deeper* fix, splitting `fixtures.ts` so screens that need only a
  // placeholder constant don't pull in the whole mock dataset, is a
  // separate, larger refactor, deliberately not done in this pass).
  if (__DEV__) {
    const demo: {installDemoNativeModuleIfUnavailable: () => void} = require('../../native-client/demoNativeModule');
    demo.installDemoNativeModuleIfUnavailable();
  }

  const client = createMediaReminderClient({
    logger: logger.child({module: 'bridge'}),
    newCorrelationId: () => ids.correlationId(),
    strictContractVersion: flags.strictContractVersion,
  });

  const preferences = createNativePreferencesStore({
    client,
    logger: logger.child({module: 'preferences'}),
  });

  const repositories = createRepositories({client, preferences});

  const appearance = createAppearanceService({
    settings: repositories.settings,
    client,
    logger: logger.child({module: 'appearance'}),
    // API 26 (ADR-019 minSdk) is a safe default: below the dynamic-color
    // floor, so Material You resolves to unsupported until startup reports
    // the real level.
    apiLevel: options.apiLevel ?? 26,
  });

  const viewState = createInMemoryKeyValueStore();
  const queryClient = createQueryClient({logger: logger.child({module: 'query'})});

  return {
    logger,
    flags,
    ids,
    clock,
    haptics,
    client,
    repositories,
    preferences,
    appearance,
    viewState,
    queryClient,
  };
};
