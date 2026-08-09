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
  CapabilityKind,
  CapabilitySnapshot,
  NotificationPermissionResult,
  EnableResult,
  ExportRequest,
  DeleteMediaRequest,
  ExportResult,
  ImportCommitRequest,
  ImportRequest,
  MediaDetail,
  MediaQuery,
  MediaSummary,
  MutationResult,
  Page,
  PickedDocument,
  PreferencePatch,
  PreferencesSnapshot,
  ReminderDetail,
  ReminderProfile,
  ReminderSummary,
  SaveReminderRequest,
  SaveReminderResult,
  TestReminderRequest,
  TestReminderResult,
  UpdateMediaRequest,
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
  get(id: UUID): Promise<Result<MediaDetail, AppError>>;
  /** `ok(null)`, not an error, when the user backed out of the picker with no selection. */
  pickDocument(mimeTypes: readonly string[]): Promise<Result<PickedDocument | null, AppError>>;
  beginImport(request: ImportRequest): Promise<Result<MediaDetail, AppError>>;
  update(request: UpdateMediaRequest): Promise<Result<MediaDetail, AppError>>;
  /** MR-03 "Delete" — see `DeleteMediaRequest`'s doc for the cascade rule. */
  remove(request: DeleteMediaRequest): Promise<Result<MutationResult, AppError>>;
  /** MR-10 "Export selected" — opens the OS share sheet for these assets' real files. */
  exportSelected(ids: readonly UUID[]): Promise<Result<MutationResult, AppError>>;
  /**
   * Cancels an in-flight `beginImport`. Not `BackupRepository`'s own method
   * reused across a domain boundary — `cancelOperation` is one generic
   * native method (`OperationRegistry` doesn't distinguish operation kinds),
   * and each repository exposes it under the name its own screens call it
   * by, matching how the rest of this file gives each domain its own
   * use-case-shaped surface rather than a shared grab-bag.
   */
  cancelOperation(id: UUID): Promise<Result<MutationResult, AppError>>;
}

export interface ReminderRepository {
  list(): Promise<Result<Page<ReminderSummary>, AppError>>;
  get(id: UUID): Promise<Result<ReminderDetail, AppError>>;
  save(request: SaveReminderRequest): Promise<Result<SaveReminderResult, AppError>>;
  setEnabled(id: UUID, enabled: boolean): Promise<Result<EnableResult, AppError>>;
  remove(id: UUID): Promise<Result<MutationResult, AppError>>;
  scheduleTest(request: TestReminderRequest): Promise<Result<TestReminderResult, AppError>>;
  play(sessionId: UUID, nonce: string): Promise<Result<ActionResult, AppError>>;
  snooze(sessionId: UUID, minutes: number, nonce: string): Promise<Result<ActionResult, AppError>>;
  dismiss(sessionId: UUID, nonce: string): Promise<Result<ActionResult, AppError>>;
}

export interface ProfileRepository {
  list(): Promise<Result<readonly ReminderProfile[], AppError>>;
}

export interface CapabilityRepository {
  getSnapshot(): Promise<Result<CapabilitySnapshot, AppError>>;
  requestNotificationPermission(): Promise<Result<NotificationPermissionResult, AppError>>;
  openSettings(kind: CapabilityKind): Promise<Result<unknown, AppError>>;
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
