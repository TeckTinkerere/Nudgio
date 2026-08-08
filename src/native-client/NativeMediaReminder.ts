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
 *
 * ## Why every type below is declared in this one file
 *
 * RN's Codegen TypeScript parser does not support type imports from other
 * files for a `Spec` module — confirmed empirically (`docs/decision-log.md`
 * DL-045), not assumed: a type imported from a sibling file and used as a
 * method **return** type is silently swallowed (the generated schema gets
 * `VoidTypeAnnotation` instead of the real shape, no error at all); the same
 * import used as a method **parameter** type throws
 * `UnsupportedGenericParserError` outright. A type declared locally in this
 * file works correctly either way. So every DTO `Spec` references — however
 * deeply nested — has to live here, not in a separate `wireTypes.ts`.
 *
 * ## Why these types differ from `./types.ts`
 *
 * Codegen's parser additionally only understands plain object-literal
 * interfaces, primitives, arrays, nullable (`| null`), and string-literal
 * unions — never generics (`Page<T>`), `Partial<>`/mapped types,
 * branded/intersection types (`UUID = string & {brand}`), or a union of
 * differently-shaped objects (`ScheduleRuleDto`), all of which `./types.ts`
 * uses freely because those types describe the app's *rich* internal shape,
 * not the wire format (`docs/decision-log.md` DL-042).
 *
 * Every field that is a domain "branded string" (`UUID`, `Instant`,
 * `LocalDate`, `LocalTime`, `ZoneId`, `CorrelationId`, `ThumbnailToken`,
 * `ImportToken`, `ByteCount`, `Sequence`) is a plain `string` below —
 * branding has no runtime representation, so this is not a behavior change,
 * only a type-level relaxation at the one boundary that has to satisfy an
 * external tool's parser instead of just TypeScript's own checker.
 * `ScheduleRuleWire` flattens the six-variant `ScheduleRuleDto` union into
 * one object with every variant-specific field optional, discriminated by
 * `type`. `Object` (Codegen's generic-passthrough escape hatch, also
 * verified against the real parser) stands in for what `./types.ts` types
 * as `unknown`: the not-yet-settled dynamic-color payload, and every
 * declared-but-unimplemented media/capability method's request/response,
 * which always reject `MR_NOT_IMPLEMENTED` today (DL-012/DL-026) and so have
 * no real shape to commit to either.
 *
 * `src/native-client/mapping.ts` converts every wire type below to/from the
 * corresponding `./types.ts` domain type — nothing outside `native-client/`
 * imports from this file's wire types directly.
 */
import {TurboModuleRegistry} from 'react-native';
import type {TurboModule} from 'react-native';

export interface NamedRefWire {
  readonly id: string;
  readonly name: string;
}

// --- Media --------------------------------------------------------------------

export interface MediaSummaryWire {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly durationMs?: number;
  readonly sizeBytes: string;
  readonly thumbnailToken?: string;
  readonly category?: NamedRefWire;
  readonly tags: readonly NamedRefWire[];
  readonly activeReminderCount: number;
  readonly integrity: string;
  readonly createdAt: string;
}

export interface MediaDetailWire {
  readonly id: string;
  readonly kind: string;
  readonly title: string;
  readonly durationMs?: number;
  readonly sizeBytes: string;
  readonly thumbnailToken?: string;
  readonly category?: NamedRefWire;
  readonly tags: readonly NamedRefWire[];
  readonly activeReminderCount: number;
  readonly integrity: string;
  readonly createdAt: string;
  readonly notes?: string;
  readonly mimeType: string;
  readonly widthPx?: number;
  readonly heightPx?: number;
  readonly updatedAt: string;
  readonly entityVersion: number;
}

export interface MediaQueryWire {
  readonly search?: string;
  readonly kinds?: readonly string[];
  readonly categoryId?: string;
  readonly onlyMissing?: boolean;
  readonly sort?: 'recent' | 'name' | 'mostScheduled' | 'size';
  readonly offset?: number;
  readonly limit?: number;
}

export interface MediaPageWire {
  readonly items: readonly MediaSummaryWire[];
  readonly total: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

/** A file the user selected via `pickDocument`. `null` (not a rejection) means they backed out with no selection. */
export interface PickedDocumentWire {
  /** Opaque `content://` URI string. Never a filesystem path (ADR-011) and not guaranteed readable indefinitely — pass it to `beginMediaImport` promptly. */
  readonly uriToken: string;
  readonly displayName?: string;
  readonly mimeType: string;
  /** Decimal string; some content providers do not report a size. */
  readonly sizeBytes?: string;
}

export interface ImportRequestWire {
  readonly sourceUri: string;
  readonly displayName?: string;
  readonly mimeType: string;
  readonly sizeBytes?: string;
}

/**
 * MR-03 "Edit details". `title`/`notes` are each independently optional —
 * an absent key means "leave this field alone," not "clear it," so renaming
 * never requires re-sending the existing notes (and vice versa). An empty
 * string *is* a meaningful value for `notes` (clears it) but not for `title`
 * (MR-09 requires 1-160 characters; native rejects a blank title).
 */
export interface UpdateMediaRequestWire {
  readonly id: string;
  readonly title?: string;
  readonly notes?: string;
}

// --- Reminders ------------------------------------------------------------------

/**
 * MR-08's `ScheduleRuleDto` union, flattened. `type` selects which of the
 * other fields are populated; unused fields are simply absent, never null.
 */
export interface ScheduleRuleWire {
  readonly type: 'once' | 'daily' | 'weekdays' | 'monthly' | 'yearly' | 'custom';
  readonly instant?: string;
  readonly originZone?: string;
  readonly localTime?: string;
  readonly zonePolicy?: string;
  readonly isoWeekdays?: readonly number[];
  readonly dayOfMonth?: number;
  readonly month?: number;
  readonly intervalDays?: number;
  readonly anchorDate?: string;
}

export interface SnoozePolicyWire {
  readonly defaultMinutes: number;
  readonly allowCustom: boolean;
  readonly minimumMinutes: number;
  readonly maximumMinutes: number;
}

export interface OccurrenceSummaryWire {
  readonly id: string;
  readonly reminderId: string;
  readonly kind: string;
  readonly scheduledAt: string;
  readonly state: string;
}

export interface ReminderSummaryWire {
  readonly id: string;
  readonly label: string;
  readonly mediaId: string;
  readonly mediaKind: string;
  readonly thumbnailToken?: string;
  readonly profileId: string;
  readonly enabledIntent: boolean;
  readonly effectiveState: string;
  readonly nextOccurrence: OccurrenceSummaryWire | null;
  readonly repeatSummary: string;
}

export interface ReminderDetailWire {
  readonly id: string;
  readonly label: string;
  readonly mediaId: string;
  readonly mediaKind: string;
  readonly thumbnailToken?: string;
  readonly profileId: string;
  readonly enabledIntent: boolean;
  readonly effectiveState: string;
  readonly nextOccurrence: OccurrenceSummaryWire | null;
  readonly repeatSummary: string;
  readonly notes?: string;
  readonly schedule: ScheduleRuleWire;
  readonly snooze: SnoozePolicyWire;
  readonly historyEnabled: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly entityVersion: number;
}

export interface ReminderPageWire {
  readonly items: readonly ReminderSummaryWire[];
  readonly total: number;
  readonly offset: number;
  readonly hasMore: boolean;
}

export interface SaveReminderRequestWire {
  readonly id?: string;
  readonly entityVersion?: number;
  readonly mediaId: string;
  readonly label: string;
  readonly notes?: string;
  readonly schedule: ScheduleRuleWire;
  readonly profileId: string;
  readonly snooze: SnoozePolicyWire;
  readonly enabledIntent: boolean;
}

export interface CapabilityEvaluationWire {
  readonly status: 'ok' | 'limited' | 'needs_action';
  readonly effectKey?: string;
}

export interface SaveReminderResultWire {
  readonly reminder: ReminderDetailWire;
  readonly nextOccurrence: OccurrenceSummaryWire | null;
  readonly capabilityResult: CapabilityEvaluationWire;
  readonly schedulerGeneration: string;
}

export interface EnableResultWire {
  readonly reminder: ReminderSummaryWire;
  readonly nextOccurrence: OccurrenceSummaryWire | null;
}

export interface MutationResultWire {
  readonly status: 'ok' | 'limited' | 'needs_action';
  readonly affectedCount: number;
}

export interface TestReminderResultWire {
  readonly sessionId: string;
  readonly scheduledAt: string;
}

// --- Profiles ---------------------------------------------------------------------

export interface ReminderProfileWire {
  readonly id: string;
  readonly nameKey: string;
  readonly isBuiltIn: boolean;
  readonly fullScreenWhenLocked: boolean;
  readonly timeoutSeconds: number;
  readonly retryCount: number;
  readonly graceSeconds: number;
  readonly defaultSnoozeMinutes: number;
  readonly entityVersion: number;
}

// --- Capability -----------------------------------------------------------------

export interface CapabilityItemWire {
  readonly kind: string;
  readonly status: string;
  readonly effectKey: string;
  readonly action: string;
  readonly observedAt: string;
}

export interface CapabilitySnapshotWire {
  readonly overall: 'ok' | 'limited' | 'needs_action';
  readonly items: readonly CapabilityItemWire[];
  readonly observedAt: string;
}

// --- Startup ------------------------------------------------------------------------

export interface RepairSummaryWire {
  readonly inProgress: boolean;
  readonly pendingOperations: number;
  readonly lastResultKey?: string;
}

export interface ActiveSessionSummaryWire {
  readonly sessionId: string;
  readonly occurrenceId: string;
  readonly reminderId: string;
  readonly startedAt: string;
}

export interface StartupSnapshotWire {
  readonly contractVersion: number;
  readonly schemaVersion: number;
  readonly appVersion: string;
  readonly buildVariant: string;
  readonly mediaCount: number;
  readonly activeReminderCount: number;
  readonly nextOccurrence: OccurrenceSummaryWire | null;
  readonly capability: CapabilitySnapshotWire;
  readonly repair: RepairSummaryWire;
  readonly activeSession: ActiveSessionSummaryWire | null;
  readonly sequence: string;
}

// --- Operations -----------------------------------------------------------------

export interface OperationRefWire {
  readonly operationId: string;
  readonly cancellable: boolean;
}

// --- Backup -------------------------------------------------------------------------

export interface ConflictSummaryWire {
  readonly kind: 'media' | 'reminder' | 'profile' | 'category' | 'tag';
  readonly count: number;
  readonly resolutionKey: string;
}

export interface BackupInspectionWire {
  readonly operationId: string;
  readonly archiveVersion: string;
  readonly createdAt: string;
  readonly sourceAppVersion: string;
  readonly mediaCount: number;
  readonly reminderCount: number;
  readonly compressedBytes: string;
  readonly expectedUncompressedBytes: string;
  readonly checksumStatus: 'valid' | 'invalid' | 'missing';
  readonly compatibility: 'compatible' | 'migratable' | 'too_new' | 'unsupported';
  readonly conflicts: readonly ConflictSummaryWire[];
  readonly warnings: readonly string[];
  readonly importToken: string;
}

export interface ExportRequestWire {
  readonly scope?: 'all';
}

export interface ExportResultWire {
  readonly fileName: string;
  readonly sizeBytes: string;
  readonly sha256: string;
}

export interface ImportCommitRequestWire {
  readonly operationId: string;
  readonly importToken: string;
  readonly mode: 'inspect' | 'merge' | 'replace';
}

// --- Alarm action contract -----------------------------------------------------------

export interface ActionResultWire {
  readonly sessionId: string;
  readonly outcome:
    | 'playing'
    | 'snoozed'
    | 'dismissed'
    | 'already_resolved'
    | 'media_unavailable'
    | 'failed_safe';
  readonly effectiveAt: string;
  readonly snoozedUntil?: string;
  readonly nextOccurrence?: OccurrenceSummaryWire;
}

// --- Preferences ----------------------------------------------------------------------

export interface PreferencesSnapshotWire {
  readonly themePreference: 'system' | 'light' | 'dark';
  readonly useMaterialYou: boolean;
  readonly use24HourTime: boolean | null;
  readonly languageTag: string | null;
  readonly hasCompletedOnboarding: boolean;
  readonly defaultSnoozeMinutes: number;
}

/**
 * Spelled out explicitly instead of `Partial<PreferencesSnapshotWire>` —
 * Codegen cannot resolve `Partial<>` (a mapped/utility type). Structurally
 * identical to what `Partial<>` would have produced.
 */
export interface PreferencePatchWire {
  readonly themePreference?: 'system' | 'light' | 'dark';
  readonly useMaterialYou?: boolean;
  readonly use24HourTime?: boolean | null;
  readonly languageTag?: string | null;
  readonly hasCompletedOnboarding?: boolean;
  readonly defaultSnoozeMinutes?: number;
}

/**
 * The Codegen spec (MR-08 "Native module surface"). Methods return
 * `Promise` of a serializable DTO and reject with the MR-08
 * `NativeErrorEnvelope`. Large media bytes never cross this boundary.
 *
 * The reminder-scheduling group (`saveReminder` through `dismissDueSession`)
 * is implemented as of the recurrence-engine slice (docs/decision-log.md
 * DL-005 onward); the backup group (`beginExport` through `cancelOperation`)
 * is implemented as of the backup-engine slice (DL-025 onward); the media
 * library's read side (`listMedia`/`getMedia`), import
 * (`pickDocument`/`beginMediaImport`) and rename (`updateMedia`) are
 * implemented as of DL-053/DL-054 and this slice — see
 * `MediaReminderModule.kt` and `android/.../media/`. `deleteMedia` remains
 * declared-but-unimplemented.
 */
export interface Spec extends TurboModule {
  // --- Implemented in the foundation ---------------------------------------
  getStartupSnapshot(): Promise<StartupSnapshotWire>;
  getCapabilitySnapshot(): Promise<CapabilitySnapshotWire>;
  getPreferences(): Promise<PreferencesSnapshotWire>;
  setPreferences(patch: PreferencePatchWire): Promise<PreferencesSnapshotWire>;
  /**
   * Android `system_accent*` / `system_neutral*` ramps (API 31+).
   * Resolves to `null` below API 31 or when no palette is reported.
   */
  getDynamicColorScheme(): Promise<Object | null>;

  listMedia(query: MediaQueryWire): Promise<MediaPageWire>;
  getMedia(id: string): Promise<MediaDetailWire>;
  listProfiles(): Promise<readonly ReminderProfileWire[]>;

  /**
   * ADR-011 "Use system pickers": launches the Photo Picker (visual-only
   * `mimeTypes`, API 33+) or SAF document picker, and resolves once the user
   * has chosen — `null` (not a rejection) means they backed out with no
   * selection. `mimeTypes` are patterns like `image/*`/`audio/*`, matching
   * `Intent.EXTRA_MIME_TYPES` semantics.
   */
  pickDocument(mimeTypes: readonly string[]): Promise<PickedDocumentWire | null>;

  // --- Reminder engine (implemented — see module doc above) ------------------
  listReminders(): Promise<ReminderPageWire>;
  getReminder(id: string): Promise<ReminderDetailWire>;
  saveReminder(request: SaveReminderRequestWire): Promise<SaveReminderResultWire>;
  setReminderEnabled(id: string, enabled: boolean): Promise<EnableResultWire>;
  deleteReminder(id: string): Promise<MutationResultWire>;
  scheduleTestReminder(mode: 'locked' | 'unlocked'): Promise<TestReminderResultWire>;

  playDueSession(sessionId: string, nonce: string): Promise<ActionResultWire>;
  snoozeDueSession(sessionId: string, minutes: number, nonce: string): Promise<ActionResultWire>;
  dismissDueSession(sessionId: string, nonce: string): Promise<ActionResultWire>;

  // --- Backup engine (implemented — see module doc above) ---------------------
  /**
   * Resolves once the whole archive is written (today's export has no
   * large media stream to justify a fire-and-forget `OperationRef` +
   * separate completion event — see docs/decision-log.md). Progress still
   * streams via `operationProgress` (`DeviceEventEmitter`) throughout.
   */
  beginExport(request: ExportRequestWire): Promise<ExportResultWire>;
  inspectBackup(uriToken: string): Promise<BackupInspectionWire>;
  commitImport(request: ImportCommitRequestWire): Promise<MutationResultWire>;
  cancelOperation(id: string): Promise<MutationResultWire>;

  /**
   * MR-05 "Import transaction". Resolves once the file is copied, hashed,
   * probed and inserted — a media file genuinely can be large enough to
   * justify streaming `operationProgress` throughout (tagged `kind:
   * "import"`), unlike `beginExport`'s reasoning above. The JS side learns
   * `operationId` from the first such event and can pass it to
   * `cancelOperation`, the same pattern already established for backup
   * export/inspection. `request.sourceUri` must come from a `pickDocument`
   * call earlier in the same session (see that method's doc).
   */
  beginMediaImport(request: ImportRequestWire): Promise<MediaDetailWire>;

  /** MR-03 "Edit details" — see `UpdateMediaRequestWire`'s doc for the optional-field rules. */
  updateMedia(request: UpdateMediaRequestWire): Promise<MediaDetailWire>;

  // --- Declared contract, not yet implemented --------------------------------
  deleteMedia(request: Object): Promise<MutationResultWire>;

  saveProfile(request: Object): Promise<ReminderProfileWire>;
  resetBuiltInProfile(id: string): Promise<ReminderProfileWire>;

  openCapabilitySettings(kind: string): Promise<Object>;
}

/**
 * Kept as the public name every pre-existing consumer in this codebase was
 * written against, aliased to `Spec` rather than renamed at every call site.
 */
export type MediaReminderSpec = Spec;

/** Must match the Kotlin `MediaReminderModule.NAME`. */
export const NATIVE_MODULE_NAME = 'MediaReminder';

let override: Spec | null = null;

/**
 * Returns the native module, or `null` when it is unavailable.
 *
 * Tests install a typed fake with `installMockNativeModule()`; dev-only
 * screen work installs one with `installDemoNativeModuleIfUnavailable()`
 * (`demoNativeModule.ts`). Neither mocks this module's internals directly.
 */
export const getNativeMediaReminder = (): Spec | null => {
  if (override !== null) {
    return override;
  }
  // Codegen statically parses this exact call and requires both the type
  // argument to be the literal `Spec` (not an alias) and the argument to be
  // a string literal (not the NATIVE_MODULE_NAME identifier, even though
  // it's a same-file top-level constant) —
  // IncorrectModuleRegistryCallTypeParameterParserError /
  // IncorrectModuleRegistryCallArgumentTypeParserError otherwise. The
  // string must stay in sync with NATIVE_MODULE_NAME above by hand.
  return TurboModuleRegistry.get<Spec>('MediaReminder');
};

/**
 * The single override seam used by both `installMockNativeModule` (tests)
 * and `installDemoNativeModuleIfUnavailable` (dev-only screen work). Pass
 * `null` to restore the real `TurboModuleRegistry` lookup.
 */
export const __setNativeMediaReminderOverride = (module: Spec | null): void => {
  override = module;
};
