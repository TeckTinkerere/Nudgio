/**
 * TurboModule accessor.
 *
 * This is the ONLY file permitted to touch `TurboModuleRegistry` — enforced by
 * the `no-restricted-imports` override in `.eslintrc.js`. Everything else goes
 * through `MediaReminderClient`, which adds decoding, error normalization and
 * the `Result` envelope.
 *
 * `getEnforcing` is deliberately not used. A missing module must degrade to a
 * typed `MR_BRIDGE_UNAVAILABLE` error the UI can render, not a hard throw at
 * import time that white-screens the app in a Metro-only dev session.
 */
import {TurboModuleRegistry} from 'react-native';
import type {TurboModule} from 'react-native';

import type {
  ActionResult,
  BackupInspection,
  CapabilitySnapshot,
  EnableResult,
  ExportRequest,
  ExportResult,
  ImportCommitRequest,
  MediaDetail,
  MediaQuery,
  MutationResult,
  OperationRef,
  Page,
  PreferencePatch,
  PreferencesSnapshot,
  ReminderDetail,
  ReminderProfile,
  ReminderSummary,
  SaveReminderRequest,
  SaveReminderResult,
  StartupSnapshot,
  TestMode,
  TestReminderResult,
  MediaSummary,
  UUID,
} from './types';

/**
 * The generated Codegen spec (MR-08 "Native module surface").
 *
 * Methods return `Promise` of a serializable DTO and reject with the MR-08
 * `NativeErrorEnvelope`. Large media bytes never cross this boundary.
 *
 * The reminder-scheduling group (`saveReminder` through `dismissDueSession`)
 * is implemented as of the recurrence-engine slice (docs/decision-log.md
 * DL-005 onward); the backup group (`beginExport` through `cancelOperation`)
 * is implemented as of the backup-engine slice (DL-025 onward) — see
 * `MediaReminderModule.kt`. Media import remains declared-but-unimplemented;
 * `media/` is still a README placeholder.
 */
export interface MediaReminderSpec extends TurboModule {
  // --- Implemented in the foundation ---------------------------------------
  getStartupSnapshot(): Promise<StartupSnapshot>;
  getCapabilitySnapshot(): Promise<CapabilitySnapshot>;
  getPreferences(): Promise<PreferencesSnapshot>;
  setPreferences(patch: PreferencePatch): Promise<PreferencesSnapshot>;
  /**
   * Android `system_accent*` / `system_neutral*` ramps (API 31+).
   * Resolves to `null` below API 31 or when no palette is reported.
   */
  getDynamicColorScheme(): Promise<unknown | null>;

  listMedia(query: MediaQuery): Promise<Page<MediaSummary>>;
  listProfiles(): Promise<readonly ReminderProfile[]>;

  // --- Reminder engine (implemented — see module doc above) ------------------
  listReminders(): Promise<Page<ReminderSummary>>;
  getReminder(id: UUID): Promise<ReminderDetail>;
  saveReminder(request: SaveReminderRequest): Promise<SaveReminderResult>;
  setReminderEnabled(id: UUID, enabled: boolean): Promise<EnableResult>;
  deleteReminder(id: UUID): Promise<MutationResult>;
  scheduleTestReminder(mode: TestMode): Promise<TestReminderResult>;

  playDueSession(sessionId: UUID, nonce: string): Promise<ActionResult>;
  snoozeDueSession(sessionId: UUID, minutes: number, nonce: string): Promise<ActionResult>;
  dismissDueSession(sessionId: UUID, nonce: string): Promise<ActionResult>;

  // --- Backup engine (implemented — see module doc above) ---------------------
  /**
   * Resolves once the whole archive is written (today's export has no
   * large media stream to justify a fire-and-forget `OperationRef` +
   * separate completion event — see docs/decision-log.md). Progress still
   * streams via `operationProgress` (`DeviceEventEmitter`) throughout.
   */
  beginExport(request: ExportRequest): Promise<ExportResult>;
  inspectBackup(uriToken: string): Promise<BackupInspection>;
  commitImport(request: ImportCommitRequest): Promise<MutationResult>;
  cancelOperation(id: UUID): Promise<MutationResult>;

  // --- Declared contract, not yet implemented --------------------------------
  getMedia(id: UUID): Promise<MediaDetail>;
  beginMediaImport(request: unknown): Promise<OperationRef>;
  updateMedia(request: unknown): Promise<MediaDetail>;
  deleteMedia(request: unknown): Promise<MutationResult>;

  saveProfile(request: unknown): Promise<ReminderProfile>;
  resetBuiltInProfile(id: UUID): Promise<ReminderProfile>;

  openCapabilitySettings(kind: string): Promise<unknown>;
}

/** Must match the Kotlin `MediaReminderModule.NAME`. */
export const NATIVE_MODULE_NAME = 'MediaReminder';

let override: MediaReminderSpec | null = null;

/**
 * Returns the native module, or `null` when it is unavailable.
 *
 * Tests install a typed fake with `installMockNativeModule()`; dev-only
 * screen work installs one with `installDemoNativeModuleIfUnavailable()`
 * (`demoNativeModule.ts`). Neither mocks this module's internals directly.
 */
export const getNativeMediaReminder = (): MediaReminderSpec | null => {
  if (override !== null) {
    return override;
  }
  return TurboModuleRegistry.get<MediaReminderSpec>(NATIVE_MODULE_NAME);
};

/**
 * The single override seam used by both `installMockNativeModule` (tests)
 * and `installDemoNativeModuleIfUnavailable` (dev-only screen work). Pass
 * `null` to restore the real `TurboModuleRegistry` lookup.
 */
export const __setNativeMediaReminderOverride = (
  module: MediaReminderSpec | null,
): void => {
  override = module;
};
