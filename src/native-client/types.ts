/**
 * Bridge data transfer objects (MR-08).
 *
 * These types are the TypeScript half of the contract. The rules from MR-08
 * "Contract principles" are encoded structurally where possible:
 *
 *  - UUIDs are lowercase canonical strings;
 *  - instants are UTC ISO-8601 strings;
 *  - byte sizes are decimal *strings*, because a media file can exceed
 *    `Number.MAX_SAFE_INTEGER` when expressed in bytes;
 *  - no field carries a filesystem path, an Android URI or a PendingIntent.
 *
 * Branded aliases make the last point checkable: a `ThumbnailToken` cannot be
 * passed where a URL is expected, because it is opaque by construction.
 */

declare const brand: unique symbol;
type Brand<T, B> = T & {readonly [brand]: B};

export type UUID = Brand<string, 'UUID'>;
/** UTC, e.g. `2026-08-05T22:15:00Z`. */
export type Instant = Brand<string, 'Instant'>;
/** `YYYY-MM-DD`. */
export type LocalDate = Brand<string, 'LocalDate'>;
/** `HH:mm:ss`. */
export type LocalTime = Brand<string, 'LocalTime'>;
/** IANA identifier, e.g. `Asia/Singapore`. */
export type ZoneId = Brand<string, 'ZoneId'>;
export type CorrelationId = Brand<string, 'CorrelationId'>;
/**
 * Opaque handle consumed by the app-local image provider. MR-08: "it is not an
 * absolute path."
 */
export type ThumbnailToken = Brand<string, 'ThumbnailToken'>;
/** References validated private staging. Expires. Never a raw URI. */
export type ImportToken = Brand<string, 'ImportToken'>;
/** Decimal string; may exceed `Number.MAX_SAFE_INTEGER`. */
export type ByteCount = Brand<string, 'ByteCount'>;
/** Monotonic sequence for event-gap detection. */
export type Sequence = Brand<string, 'Sequence'>;

export type ResultStatus = 'ok' | 'limited' | 'needs_action';

export interface NamedRef {
  readonly id: UUID;
  readonly name: string;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

// --- Media (MR-08 "Media DTOs") ---------------------------------------------

export type MediaKind = 'video' | 'audio' | 'image' | 'text';

export type IntegrityState =
  | 'healthy'
  | 'unchecked'
  | 'missing'
  | 'changed'
  | 'unsupported';

export interface MediaSummary {
  readonly id: UUID;
  readonly kind: MediaKind;
  readonly title: string;
  readonly durationMs?: number;
  readonly sizeBytes: ByteCount;
  readonly thumbnailToken?: ThumbnailToken;
  readonly category?: NamedRef;
  readonly tags: readonly NamedRef[];
  readonly activeReminderCount: number;
  readonly integrity: IntegrityState;
  readonly createdAt: Instant;
}

export interface MediaDetail extends MediaSummary {
  readonly notes?: string;
  readonly mimeType: string;
  readonly widthPx?: number;
  readonly heightPx?: number;
  readonly updatedAt: Instant;
  readonly entityVersion: number;
}

export interface MediaQuery {
  readonly search?: string;
  readonly kinds?: readonly MediaKind[];
  readonly categoryId?: UUID;
  readonly onlyMissing?: boolean;
  readonly sort?: 'recent' | 'name' | 'mostScheduled' | 'size';
  readonly offset?: number;
  readonly limit?: number;
}

/** A file the user selected via `pickDocument`. */
export interface PickedDocument {
  /** Opaque `content://` URI string. Never a filesystem path (ADR-011). */
  readonly uriToken: string;
  readonly displayName?: string;
  readonly mimeType: string;
  /** Some content providers do not report a size. */
  readonly sizeBytes?: ByteCount;
}

export interface ImportRequest {
  readonly sourceUri: string;
  readonly displayName?: string;
  readonly mimeType: string;
  readonly sizeBytes?: ByteCount;
}

// --- Reminders (MR-08 "Reminder DTOs") ---------------------------------------

export type ReminderEffectiveState = 'disabled' | 'needs_setup' | 'active' | 'archived';

/**
 * Reminder engine repeat types. `once`/`daily`/`weekdays` are the original
 * MR-08 baseline; `monthly`/`yearly`/`custom` were added when the recurrence
 * engine was implemented (see docs/decision-log.md DL-005). This is an
 * additive change to the union — every existing consumer that switches on
 * `type` still compiles unchanged, so per MR-08 "Versioning rules" it does
 * not require a bridge contract version bump ("changes only for breaking
 * semantics").
 *
 * Every variant's `localTime`/date fields are the *local* wall-clock value
 * the user picked; DST and timezone resolution happen once, natively, in
 * `OccurrenceCalculator` — never on the JS side (MR-08: "UI never calculates
 * authoritative next occurrence").
 */
export type ScheduleRuleDto =
  | {readonly type: 'once'; readonly instant: Instant; readonly originZone: ZoneId}
  | {
      readonly type: 'daily';
      readonly localTime: LocalTime;
      readonly zonePolicy: 'follow_device';
    }
  | {
      readonly type: 'weekdays';
      readonly localTime: LocalTime;
      /** ISO-8601 weekday numbers, Monday = 1 (MR-13: store ISO, display local). */
      readonly isoWeekdays: readonly number[];
      readonly zonePolicy: 'follow_device';
    }
  | {
      readonly type: 'monthly';
      readonly localTime: LocalTime;
      /** 1-31. Clamped to the month's actual last day (e.g. 31 in February). */
      readonly dayOfMonth: number;
      readonly zonePolicy: 'follow_device';
    }
  | {
      readonly type: 'yearly';
      readonly localTime: LocalTime;
      /** 1-12. */
      readonly month: number;
      /** 1-31, clamped like `monthly`'s (matters for Feb 29 in non-leap years). */
      readonly dayOfMonth: number;
      readonly zonePolicy: 'follow_device';
    }
  | {
      readonly type: 'custom';
      readonly localTime: LocalTime;
      /** Every N days, N >= 1. */
      readonly intervalDays: number;
      /** Local date the interval counts from, so the cadence has a fixed phase. */
      readonly anchorDate: LocalDate;
      readonly zonePolicy: 'follow_device';
    };

export interface SnoozePolicyDto {
  readonly defaultMinutes: number;
  readonly allowCustom: boolean;
  readonly minimumMinutes: number;
  readonly maximumMinutes: number;
}

export interface ReminderSummary {
  readonly id: UUID;
  readonly label: string;
  readonly mediaId: UUID;
  readonly mediaKind: MediaKind;
  readonly thumbnailToken?: ThumbnailToken;
  readonly profileId: UUID;
  readonly enabledIntent: boolean;
  readonly effectiveState: ReminderEffectiveState;
  readonly nextOccurrence: OccurrenceSummary | null;
  /**
   * Plain-language repeat summary, already localized on the native side
   * (MR-13: "Repeat rules are summarized in plain language"). This is
   * rendered text, not a lookup key — display it directly.
   */
  readonly repeatSummary: string;
}

export interface ReminderDetail extends ReminderSummary {
  readonly notes?: string;
  readonly schedule: ScheduleRuleDto;
  readonly snooze: SnoozePolicyDto;
  readonly historyEnabled: boolean;
  readonly createdAt: Instant;
  readonly updatedAt: Instant;
  readonly entityVersion: number;
}

/**
 * MR-08 "Reminder DTOs": `saveReminder` request. `id` absent means create;
 * present means update, and `entityVersion` (when present) is the optimistic
 * concurrency token — a stale version is rejected rather than silently
 * overwriting a concurrent edit (MR-08 "Event ordering and idempotency").
 */
export interface SaveReminderRequest {
  readonly id?: UUID;
  readonly entityVersion?: number;
  readonly mediaId: UUID;
  readonly label: string;
  readonly notes?: string;
  readonly schedule: ScheduleRuleDto;
  readonly profileId: UUID;
  readonly snooze: SnoozePolicyDto;
  readonly enabledIntent: boolean;
}

/**
 * MR-08: "UI never calculates authoritative next occurrence... Save returns
 * native-calculated truth and any DST resolution." `capabilityResult` tells
 * the editor whether the save actually produced a live, exact-scheduled
 * reminder or one waiting on a capability (e.g. exact-alarm access).
 */
export interface CapabilityEvaluation {
  readonly status: ResultStatus;
  /** Localization key for the plain-language consequence, or absent when `ok`. */
  readonly effectKey?: string;
}

export interface SaveReminderResult {
  readonly reminder: ReminderDetail;
  readonly nextOccurrence: OccurrenceSummary | null;
  readonly capabilityResult: CapabilityEvaluation;
  /** Scheduler outbox generation after this save (MR-07 "Scheduler transaction pattern"). */
  readonly schedulerGeneration: string;
}

export interface EnableResult {
  readonly reminder: ReminderSummary;
  readonly nextOccurrence: OccurrenceSummary | null;
}

/** MR-08 `TestMode`: which adaptive-presentation path the Test reminder exercises. */
export type TestMode = 'locked' | 'unlocked';

export interface TestReminderResult {
  readonly sessionId: UUID;
  readonly scheduledAt: Instant;
}

export type OccurrenceKind = 'base' | 'snooze' | 'retry' | 'test';

export type OccurrenceState =
  | 'pending'
  | 'claimed'
  | 'accepted'
  | 'snoozed'
  | 'dismissed'
  | 'missed'
  | 'timed_out'
  | 'failed_safe';

export interface OccurrenceSummary {
  readonly id: UUID;
  readonly reminderId: UUID;
  readonly kind: OccurrenceKind;
  readonly scheduledAt: Instant;
  readonly state: OccurrenceState;
}

// --- Profiles (ADR-018) -------------------------------------------------------

export interface ReminderProfile {
  readonly id: UUID;
  /** Localization key for built-ins; free text for user profiles (MR-13). */
  readonly nameKey: string;
  readonly isBuiltIn: boolean;
  readonly fullScreenWhenLocked: boolean;
  readonly timeoutSeconds: number;
  readonly retryCount: number;
  readonly graceSeconds: number;
  readonly defaultSnoozeMinutes: number;
  readonly entityVersion: number;
}

// --- Capability (MR-08 "Capability contract") ----------------------------------

export type CapabilityKind =
  | 'notifications'
  | 'exact_alarm'
  | 'full_screen_intent'
  | 'channels'
  | 'battery_environment'
  | 'scheduler';

export type CapabilityStatus = 'ready' | 'limited' | 'blocked' | 'unknown';

export type CapabilityAction =
  | 'none'
  | 'request_runtime'
  | 'open_special_access'
  | 'open_channel'
  | 'run_test'
  | 'open_app';

export interface CapabilityItem {
  readonly kind: CapabilityKind;
  readonly status: CapabilityStatus;
  /** Localization key for the plain-language consequence (MR-03 Health). */
  readonly effectKey: string;
  readonly action: CapabilityAction;
  readonly observedAt: Instant;
}

export interface CapabilitySnapshot {
  readonly overall: ResultStatus;
  readonly items: readonly CapabilityItem[];
  readonly observedAt: Instant;
}

// --- Startup (MR-08 "Startup snapshot") ----------------------------------------

export interface RepairSummary {
  readonly inProgress: boolean;
  readonly pendingOperations: number;
  readonly lastResultKey?: string;
}

export interface ActiveSessionSummary {
  readonly sessionId: UUID;
  readonly occurrenceId: UUID;
  readonly reminderId: UUID;
  readonly startedAt: Instant;
}

export interface StartupSnapshot {
  readonly contractVersion: number;
  readonly schemaVersion: number;
  readonly appVersion: string;
  /** MR-07 build variant, so JS flags follow the actual build. */
  readonly buildVariant: string;
  readonly mediaCount: number;
  readonly activeReminderCount: number;
  readonly nextOccurrence: OccurrenceSummary | null;
  readonly capability: CapabilitySnapshot;
  readonly repair: RepairSummary;
  readonly activeSession: ActiveSessionSummary | null;
  readonly sequence: Sequence;
}

// --- Operations (MR-08 "Operations and progress") -------------------------------

export interface OperationRef {
  readonly operationId: UUID;
  readonly cancellable: boolean;
}

export type OperationKind =
  | 'import'
  | 'export'
  | 'backup_inspection'
  | 'backup_commit'
  | 'repair';

export interface OperationProgressEvent {
  readonly operationId: UUID;
  readonly kind: OperationKind;
  /** Phase key: `copying`, `checking`, `creating_preview`, `ready` (MR-03). */
  readonly phase: string;
  readonly completedUnits?: ByteCount;
  readonly totalUnits?: ByteCount;
  readonly currentItemIndex?: number;
  readonly totalItems?: number;
  readonly cancellable: boolean;
  readonly sequence: Sequence;
  readonly correlationId: CorrelationId;
}

// --- Backup (MR-08 "Backup contract", MR-03 "Backup UX") ------------------------

export type BackupCompatibility = 'compatible' | 'migratable' | 'too_new' | 'unsupported';

export interface ConflictSummary {
  readonly kind: 'media' | 'reminder' | 'profile' | 'category' | 'tag';
  readonly count: number;
  /** Localization key for the plain-language resolution, e.g. "Kept newer". */
  readonly resolutionKey: string;
}

export interface BackupInspection {
  /** Correlates this inspection with the operation `commitImport`/`cancelOperation` act on — the same id `operationProgress` events during inspection carried. */
  readonly operationId: UUID;
  readonly archiveVersion: string;
  readonly createdAt: Instant;
  readonly sourceAppVersion: string;
  readonly mediaCount: number;
  readonly reminderCount: number;
  readonly compressedBytes: ByteCount;
  readonly expectedUncompressedBytes: ByteCount;
  readonly checksumStatus: 'valid' | 'invalid' | 'missing';
  readonly compatibility: BackupCompatibility;
  readonly conflicts: readonly ConflictSummary[];
  /** Already-localized warning strings (MR-03), not translation keys. */
  readonly warnings: readonly string[];
  /** References validated private staging; expires. Never a raw URI. */
  readonly importToken: string;
}

/** MR-03 "Export": the summary shown before the user chooses a destination. */
export interface ExportPreview {
  readonly mediaCount: number;
  readonly reminderCount: number;
  readonly estimatedBytes: ByteCount;
}

/** Reserved for future export-scope options; v1 always exports `scope: "all"` (MR-10). */
export interface ExportRequest {
  readonly scope?: 'all';
}

export interface ExportResult {
  readonly fileName: string;
  readonly sizeBytes: ByteCount;
  readonly sha256: string;
}

/** MR-10 "Import modes": `'inspect'` performs no mutation. */
export type ImportMode = 'inspect' | 'merge' | 'replace';

export interface ImportCommitRequest {
  readonly operationId: UUID;
  readonly importToken: string;
  readonly mode: ImportMode;
}

export interface MutationResult {
  readonly status: ResultStatus;
  readonly affectedCount: number;
}

// --- Alarm action contract (MR-08 "Alarm action contract") -----------------------

/**
 * "Action nonce is generated by native notification/activity code. A result
 * may be replayed for an identical nonce." `already_resolved` is a
 * success-like outcome (MR-08 `MR_ACTION_ALREADY_RESOLVED`), not an error —
 * it is what a duplicate notification-action tap or a replayed intent
 * produces, and the UI treats it exactly like the original result.
 */
export type ActionOutcome =
  | 'playing'
  | 'snoozed'
  | 'dismissed'
  | 'already_resolved'
  | 'media_unavailable'
  | 'failed_safe';

export interface ActionResult {
  readonly sessionId: UUID;
  readonly outcome: ActionOutcome;
  readonly effectiveAt: Instant;
  readonly snoozedUntil?: Instant;
  readonly nextOccurrence?: OccurrenceSummary;
}

// --- Preferences (owned by DataStore natively, MR-07) ---------------------------

export interface PreferencesSnapshot {
  readonly themePreference: 'system' | 'light' | 'dark';
  readonly useMaterialYou: boolean;
  readonly use24HourTime: boolean | null;
  readonly languageTag: string | null;
  readonly hasCompletedOnboarding: boolean;
  readonly defaultSnoozeMinutes: number;
}

export type PreferencePatch = Partial<PreferencesSnapshot>;
