/**
 * Test double for `AppContainer`.
 *
 * Builds the same shape `createAppContainer` does, but wires the mock native
 * module and a recording logger by default so a test can assert on both
 * bridge calls and log events without touching a real Android build.
 */
import type {AppContainer} from '../app/di';
import {featureFlagsFor, type FeatureFlags} from '../core/config/featureFlags';
import {createRecordingLogger, type RecordingLogger} from '../core/logging';
import {createRepositories, type Repositories} from '../core/repositories';
import {
  createAppearanceService,
  createRecordingHaptics,
  createSequentialIdGenerator,
  createSystemClock,
  type AppearanceService,
  type ClockService,
  type RecordingHaptics,
} from '../core/services';
import {createQueryClient} from '../core/state';
import {
  createInMemoryKeyValueStore,
  createInMemoryPreferencesStore,
  type KeyValueStore,
  type PreferencesStore,
} from '../core/storage';
import {
  installMockNativeModule,
  type MediaReminderClient,
  type MockNativeOptions,
} from '../native-client';
import {createMediaReminderClient} from '../native-client/MediaReminderClient';

export interface TestContainer extends AppContainer {
  readonly logger: RecordingLogger;
  readonly haptics: RecordingHaptics;
  /** Restores the real (null under Jest) native module lookup. */
  readonly uninstallNativeModule: () => void;
}

export interface CreateTestContainerOptions {
  readonly native?: MockNativeOptions;
  readonly flags?: Partial<FeatureFlags>;
  readonly apiLevel?: number;
  readonly preferences?: Parameters<typeof createInMemoryPreferencesStore>[0];
}

export const createTestContainer = (
  options: CreateTestContainerOptions = {},
): TestContainer => {
  const uninstallNativeModule = installMockNativeModule(options.native);

  const logger = createRecordingLogger();
  const ids = createSequentialIdGenerator();
  const clock: ClockService = createSystemClock();
  const haptics = createRecordingHaptics();
  const flags: FeatureFlags = {...featureFlagsFor('debug'), ...options.flags};

  const client: MediaReminderClient = createMediaReminderClient({
    logger,
    newCorrelationId: () => ids.correlationId(),
    strictContractVersion: flags.strictContractVersion,
  });

  const preferences: PreferencesStore = createInMemoryPreferencesStore(
    options.preferences,
  );

  const repositories: Repositories = createRepositories({client, preferences});

  const appearance: AppearanceService = createAppearanceService({
    settings: repositories.settings,
    client,
    logger,
    apiLevel: options.apiLevel ?? 26,
  });

  const viewState: KeyValueStore = createInMemoryKeyValueStore();
  const queryClient = createQueryClient({logger});

  return {
    logger,
    flags,
    // Same generator instance the client was built with, so a test asserting
    // on a correlation ID sees the exact deterministic sequence it produced.
    ids,
    clock,
    haptics,
    client,
    repositories,
    preferences,
    appearance,
    viewState,
    queryClient,
    uninstallNativeModule,
  };
};
