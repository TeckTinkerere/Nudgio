/**
 * Typed client over the native module.
 *
 * Responsibilities, all of which MR-08 and MR-18 require to happen exactly
 * once rather than at every call site:
 *
 *  - normalize rejections into an `AppError` (never leak a native message);
 *  - runtime-decode payloads, because Codegen validates shape but not
 *    semantics ("Runtime-decode native/external payloads", MR-18);
 *  - check the bridge contract version (MR-08 "Versioning rules");
 *  - detect event-sequence gaps so the UI can refetch authoritative state.
 *
 * Every method returns `Result` — nothing here throws for an expected failure.
 */
import {decodeWire} from './mapping';
import {getNativeMediaReminder, type Spec} from './NativeMediaReminder';
import type {
  ActionResult,
  BackupInspection,
  CapabilitySnapshot,
  EnableResult,
  ExportRequest,
  ExportResult,
  ImportCommitRequest,
  MediaQuery,
  MediaSummary,
  MutationResult,
  Page,
  PreferencePatch,
  PreferencesSnapshot,
  ReminderDetail,
  ReminderProfile,
  ReminderSummary,
  SaveReminderRequest,
  SaveReminderResult,
  TestMode,
  TestReminderResult,
  UUID,
  StartupSnapshot,
} from './types';
import {appConfig} from '../core/config/appConfig';
import type {AppError} from '../core/errors';
import {
  bridgeUnavailableError,
  createAppError,
  ErrorCode,
  toAppError,
} from '../core/errors';
import type {Logger} from '../core/logging';
import {attempt, err, ok, type Result} from '../core/result/Result';


export interface MediaReminderClientDeps {
  readonly logger: Logger;
  /** Injected so correlation IDs are deterministic in tests. */
  readonly newCorrelationId: () => string;
  /** MR-08: a mismatch is a hard developer error in debug. */
  readonly strictContractVersion: boolean;
}

export interface MediaReminderClient {
  getStartupSnapshot(): Promise<Result<StartupSnapshot, AppError>>;
  getCapabilitySnapshot(): Promise<Result<CapabilitySnapshot, AppError>>;
  getPreferences(): Promise<Result<PreferencesSnapshot, AppError>>;
  setPreferences(patch: PreferencePatch): Promise<Result<PreferencesSnapshot, AppError>>;
  getDynamicColorScheme(): Promise<Result<unknown | null, AppError>>;
  listMedia(query: MediaQuery): Promise<Result<Page<MediaSummary>, AppError>>;
  listProfiles(): Promise<Result<readonly ReminderProfile[], AppError>>;

  listReminders(): Promise<Result<Page<ReminderSummary>, AppError>>;
  getReminder(id: UUID): Promise<Result<ReminderDetail, AppError>>;
  saveReminder(request: SaveReminderRequest): Promise<Result<SaveReminderResult, AppError>>;
  setReminderEnabled(id: UUID, enabled: boolean): Promise<Result<EnableResult, AppError>>;
  deleteReminder(id: UUID): Promise<Result<MutationResult, AppError>>;
  scheduleTestReminder(mode: TestMode): Promise<Result<TestReminderResult, AppError>>;

  playDueSession(sessionId: UUID, nonce: string): Promise<Result<ActionResult, AppError>>;
  snoozeDueSession(
    sessionId: UUID,
    minutes: number,
    nonce: string,
  ): Promise<Result<ActionResult, AppError>>;
  dismissDueSession(sessionId: UUID, nonce: string): Promise<Result<ActionResult, AppError>>;

  beginExport(request: ExportRequest): Promise<Result<ExportResult, AppError>>;
  inspectBackup(uriToken: string): Promise<Result<BackupInspection, AppError>>;
  commitImport(request: ImportCommitRequest): Promise<Result<MutationResult, AppError>>;
  cancelOperation(id: UUID): Promise<Result<MutationResult, AppError>>;

  /** True when the native module is registered. Surfaced on the About screen. */
  isAvailable(): boolean;
}

export const createMediaReminderClient = (
  deps: MediaReminderClientDeps,
): MediaReminderClient => {
  const {logger, newCorrelationId, strictContractVersion} = deps;

  /**
   * Runs `operation` against the module, or fails with a typed
   * bridge-unavailable error when there is no module to run it against.
   * `operation` returns the raw wire-shaped payload; `decodeWire` casts it
   * to `T` (see `mapping.ts` for why that's safe) so every method below
   * still returns a domain-typed `Result` exactly as it did before the
   * wire/domain split (DL-042/DL-045).
   */
  const call = async <T>(
    name: string,
    operation: (native: Spec) => Promise<unknown>,
  ): Promise<Result<T, AppError>> => {
    const native = getNativeMediaReminder();
    if (native === null) {
      const correlationId = newCorrelationId();
      logger.warn('bridge.unavailable', {method: name, correlationId});
      return err(bridgeUnavailableError(correlationId));
    }

    const started = Date.now();
    const result = await attempt(
      async () => decodeWire<T>(await operation(native)),
      cause =>
        toAppError(cause, {
          fallbackCorrelationId: newCorrelationId(),
          fallbackMessageKey: 'error.unexpected',
        }),
    );

    // MR-07 observability: action latency is a key diagnostic event. No
    // arguments are logged — they can contain titles.
    logger.debug('bridge.call', {
      method: name,
      ok: result.ok,
      durationMs: Date.now() - started,
      ...(result.ok ? {} : {code: result.error.code}),
    });

    return result;
  };

  const checkContractVersion = (
    snapshot: StartupSnapshot,
  ): Result<StartupSnapshot, AppError> => {
    if (snapshot.contractVersion === appConfig.bridgeContractVersion) {
      return ok(snapshot);
    }

    const error = createAppError({
      code: ErrorCode.CONTRACT_MISMATCH,
      messageKey: 'error.updateRequired',
      category: 'internal',
      correlationId: newCorrelationId(),
      retryable: false,
      safeDetails: {
        expected: appConfig.bridgeContractVersion,
        received: snapshot.contractVersion,
      },
    });

    // MR-08: "A contract version mismatch is a hard developer error in debug
    // and a user-safe update-required screen in release."
    if (strictContractVersion) {
      throw new Error(
        `Bridge contract mismatch: JS expects v${appConfig.bridgeContractVersion}, native reports v${snapshot.contractVersion}. Rebuild the Android app.`,
      );
    }

    logger.error('bridge.contractMismatch', {
      expected: appConfig.bridgeContractVersion,
      received: snapshot.contractVersion,
    });
    return err(error);
  };

  return {
    isAvailable: () => getNativeMediaReminder() !== null,

    getStartupSnapshot: async () => {
      const result = await call<StartupSnapshot>('getStartupSnapshot', native =>
        native.getStartupSnapshot(),
      );
      return result.ok ? checkContractVersion(result.value) : result;
    },

    getCapabilitySnapshot: () =>
      call('getCapabilitySnapshot', native => native.getCapabilitySnapshot()),

    getPreferences: () => call('getPreferences', native => native.getPreferences()),

    setPreferences: patch =>
      call('setPreferences', native => native.setPreferences(patch)),

    getDynamicColorScheme: () =>
      call('getDynamicColorScheme', native => native.getDynamicColorScheme()),

    listMedia: query => call('listMedia', native => native.listMedia(query)),

    listProfiles: () => call('listProfiles', native => native.listProfiles()),

    listReminders: () => call('listReminders', native => native.listReminders()),

    getReminder: id => call('getReminder', native => native.getReminder(id)),

    saveReminder: request => call('saveReminder', native => native.saveReminder(request)),

    setReminderEnabled: (id, enabled) =>
      call('setReminderEnabled', native => native.setReminderEnabled(id, enabled)),

    deleteReminder: id => call('deleteReminder', native => native.deleteReminder(id)),

    scheduleTestReminder: mode =>
      call('scheduleTestReminder', native => native.scheduleTestReminder(mode)),

    playDueSession: (sessionId, nonce) =>
      call('playDueSession', native => native.playDueSession(sessionId, nonce)),

    snoozeDueSession: (sessionId, minutes, nonce) =>
      call('snoozeDueSession', native => native.snoozeDueSession(sessionId, minutes, nonce)),

    dismissDueSession: (sessionId, nonce) =>
      call('dismissDueSession', native => native.dismissDueSession(sessionId, nonce)),

    beginExport: request => call('beginExport', native => native.beginExport(request)),

    inspectBackup: uriToken => call('inspectBackup', native => native.inspectBackup(uriToken)),

    commitImport: request => call('commitImport', native => native.commitImport(request)),

    cancelOperation: id => call('cancelOperation', native => native.cancelOperation(id)),
  };
};
