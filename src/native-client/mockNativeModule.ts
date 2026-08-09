/**
 * In-memory fake of the native module.
 *
 * Used by Jest and by the Metro-only development flow, where the Kotlin module
 * is not loaded. It implements the same contract shape the Kotlin side does,
 * so a screen written against the client behaves identically either way.
 *
 * MR-18: fixtures are synthetic. Nothing here resembles real user content.
 */

import {
  __setNativeMediaReminderOverride,
  type MediaReminderSpec,
} from './NativeMediaReminder';
import type {
  CapabilitySnapshot,
  PreferencesSnapshot,
  ReminderProfile,
  StartupSnapshot,
  UUID,
} from './types';
import {appConfig} from '../core/config/appConfig';

const asUuid = (value: string): UUID => value as UUID;
const now = () => new Date().toISOString();

/** ADR-018 seeds Gentle, Standard and Persistent with stable built-in IDs. */
export const mockProfiles: readonly ReminderProfile[] = [
  {
    id: asUuid('00000000-0000-4000-8000-000000000001'),
    nameKey: 'profile.gentle.name',
    isBuiltIn: true,
    fullScreenWhenLocked: false,
    timeoutSeconds: 60,
    retryCount: 0,
    graceSeconds: 300,
    defaultSnoozeMinutes: 10,
    entityVersion: 1,
  },
  {
    id: asUuid('00000000-0000-4000-8000-000000000002'),
    nameKey: 'profile.standard.name',
    isBuiltIn: true,
    fullScreenWhenLocked: true,
    timeoutSeconds: 300,
    retryCount: 1,
    graceSeconds: 600,
    defaultSnoozeMinutes: 10,
    entityVersion: 1,
  },
  {
    id: asUuid('00000000-0000-4000-8000-000000000003'),
    nameKey: 'profile.persistent.name',
    isBuiltIn: true,
    fullScreenWhenLocked: true,
    timeoutSeconds: 600,
    retryCount: 3,
    graceSeconds: 900,
    defaultSnoozeMinutes: 5,
    entityVersion: 1,
  },
];

const mockCapability = (): CapabilitySnapshot => ({
  overall: 'ok',
  observedAt: now() as StartupSnapshot['capability']['observedAt'],
  items: [
    {
      kind: 'notifications',
      status: 'ready',
      effectKey: 'capability.notifications.ready',
      action: 'none',
      observedAt: now() as CapabilitySnapshot['observedAt'],
    },
    {
      kind: 'exact_alarm',
      status: 'ready',
      effectKey: 'capability.exactAlarm.ready',
      action: 'none',
      observedAt: now() as CapabilitySnapshot['observedAt'],
    },
    {
      kind: 'scheduler',
      status: 'ready',
      effectKey: 'capability.scheduler.ready',
      action: 'none',
      observedAt: now() as CapabilitySnapshot['observedAt'],
    },
  ],
});

export interface MockNativeOptions {
  readonly preferences?: Partial<PreferencesSnapshot>;
  /** Override to exercise the update-required screen. */
  readonly contractVersion?: number;
  /** Supply a payload to exercise the Material You path. */
  readonly dynamicColor?: unknown;
  readonly capability?: CapabilitySnapshot;
}

const defaultPreferences: PreferencesSnapshot = {
  themePreference: 'system',
  useMaterialYou: false,
  use24HourTime: null,
  languageTag: null,
  hasCompletedOnboarding: false,
  defaultSnoozeMinutes: 10,
};

export const createMockNativeModule = (
  options: MockNativeOptions = {},
): MediaReminderSpec => {
  let preferences: PreferencesSnapshot = {
    ...defaultPreferences,
    ...options.preferences,
  };

  const notImplemented = (method: string) => (): Promise<never> =>
    Promise.reject({
      code: 'MR_INTERNAL_FAILED_SAFE',
      messageKey: 'error.notImplemented',
      category: 'internal',
      retryable: false,
      correlationId: `mock-${method}`,
    });

  return {
    getStartupSnapshot: async (): Promise<StartupSnapshot> => ({
      contractVersion: options.contractVersion ?? appConfig.bridgeContractVersion,
      schemaVersion: 1,
      appVersion: '0.1.0',
      buildVariant: 'debug',
      mediaCount: 0,
      activeReminderCount: 0,
      nextOccurrence: null,
      capability: options.capability ?? mockCapability(),
      repair: {inProgress: false, pendingOperations: 0},
      activeSession: null,
      sequence: '1' as StartupSnapshot['sequence'],
    }),

    getCapabilitySnapshot: async () => options.capability ?? mockCapability(),

    getPreferences: async () => preferences,

    setPreferences: async patch => {
      preferences = {...preferences, ...patch};
      return preferences;
    },

    getDynamicColorScheme: async () => options.dynamicColor ?? null,

    listMedia: async () => ({items: [], total: 0, offset: 0, hasMore: false}),
    listReminders: async () => ({items: [], total: 0, offset: 0, hasMore: false}),
    listProfiles: async () => mockProfiles,

    // `null` is a real, always-correct answer for this deliberately-empty
    // fake: "no file available to pick" needs no synthetic content the way
    // `beginMediaImport` below would. A test that needs a picked file uses a
    // Jest mock/spy at a higher level, not this native-module fake.
    pickDocument: async () => null,

    // No real OS permission dialog exists in Metro-only dev mode or Jest —
    // always resolves granted, matching what a fresh install with no prior
    // denial would see.
    requestNotificationPermission: async () => ({granted: true}),

    // No real OS Settings app to deep-link to in Metro-only dev mode or Jest.
    openCapabilitySettings: async () => ({}),

    // Settings "Preview alarm styles" — echoes back a synthetic session/time
    // rather than actually scheduling an `AlarmManager` alarm, since none of
    // that exists outside a real device.
    scheduleTestReminder: async () => ({
      sessionId: asUuid('00000000-0000-4000-8000-0000000000f1'),
      scheduledAt: now() as StartupSnapshot['capability']['observedAt'],
    }),

    // Declared-but-unimplemented surface. Rejecting with the same envelope the
    // Kotlin stub uses keeps mock and device behavior identical.
    getMedia: notImplemented('getMedia'),
    beginMediaImport: notImplemented('beginMediaImport'),
    updateMedia: notImplemented('updateMedia'),
    deleteMedia: notImplemented('deleteMedia'),
    exportMediaAssets: notImplemented('exportMediaAssets'),
    getReminder: notImplemented('getReminder'),
    saveReminder: notImplemented('saveReminder'),
    setReminderEnabled: notImplemented('setReminderEnabled'),
    deleteReminder: notImplemented('deleteReminder'),
    saveProfile: notImplemented('saveProfile'),
    resetBuiltInProfile: notImplemented('resetBuiltInProfile'),
    beginExport: notImplemented('beginExport'),
    inspectBackup: notImplemented('inspectBackup'),
    commitImport: notImplemented('commitImport'),
    cancelOperation: notImplemented('cancelOperation'),
    playDueSession: notImplemented('playDueSession'),
    snoozeDueSession: notImplemented('snoozeDueSession'),
    dismissDueSession: notImplemented('dismissDueSession'),
  };
};

/** Installs the fake for the duration of a test. Returns an uninstall function. */
export const installMockNativeModule = (
  options: MockNativeOptions = {},
): (() => void) => {
  __setNativeMediaReminderOverride(createMockNativeModule(options));
  return () => __setNativeMediaReminderOverride(null);
};
