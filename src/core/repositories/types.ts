/**
 * Repository interfaces.
 *
 * MR-07 names the Kotlin-side repositories that own data. These are their
 * *client-side counterparts*: narrow, use-case shaped facades that the UI
 * depends on instead of depending on the bridge directly. That indirection is
 * what lets a screen be tested against a hand-written fake with no bridge, no
 * Room and no Android at all.
 *
 * They deliberately contain no caching. Caching is the query layer's job
 * (`core/state/queryClient.ts`), and mixing the two produces two sources of
 * staleness that disagree.
 */
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
} from '../../native-client/types';
import type {AppError} from '../errors';
import type {Result} from '../result/Result';

export interface StartupRepository {
  /**
   * MR-07: the UI requests a `StartupSnapshot` covering counts, next
   * occurrence, capability summary, repair state and schema version.
   */
  getSnapshot(): Promise<Result<StartupSnapshot, AppError>>;
}

export interface MediaRepository {
  list(query: MediaQuery): Promise<Result<Page<MediaSummary>, AppError>>;
}

export interface ReminderRepository {
  list(): Promise<Result<Page<ReminderSummary>, AppError>>;
  get(id: UUID): Promise<Result<ReminderDetail, AppError>>;
  save(request: SaveReminderRequest): Promise<Result<SaveReminderResult, AppError>>;
  setEnabled(id: UUID, enabled: boolean): Promise<Result<EnableResult, AppError>>;
  remove(id: UUID): Promise<Result<MutationResult, AppError>>;
  scheduleTest(mode: TestMode): Promise<Result<TestReminderResult, AppError>>;
  play(sessionId: UUID, nonce: string): Promise<Result<ActionResult, AppError>>;
  snooze(sessionId: UUID, minutes: number, nonce: string): Promise<Result<ActionResult, AppError>>;
  dismiss(sessionId: UUID, nonce: string): Promise<Result<ActionResult, AppError>>;
}

export interface ProfileRepository {
  list(): Promise<Result<readonly ReminderProfile[], AppError>>;
}

export interface CapabilityRepository {
  getSnapshot(): Promise<Result<CapabilitySnapshot, AppError>>;
}

export interface SettingsRepository {
  read(): Promise<Result<PreferencesSnapshot, AppError>>;
  update(patch: PreferencePatch): Promise<Result<PreferencesSnapshot, AppError>>;
}

export interface BackupRepository {
  beginExport(request: ExportRequest): Promise<Result<ExportResult, AppError>>;
  inspectBackup(uriToken: string): Promise<Result<BackupInspection, AppError>>;
  commitImport(request: ImportCommitRequest): Promise<Result<MutationResult, AppError>>;
  cancelOperation(id: UUID): Promise<Result<MutationResult, AppError>>;
}
