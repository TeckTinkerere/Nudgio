package com.aslam.mediareminder.bridge

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import com.aslam.mediareminder.BuildConfig
import com.aslam.mediareminder.alarm.AlarmActionProcessor
import com.aslam.mediareminder.alarm.AlarmIds
import com.aslam.mediareminder.alarm.AlarmRingingService
import com.aslam.mediareminder.alarm.SchedulerCoordinator
import com.aslam.mediareminder.backup.BackupCancelledException
import com.aslam.mediareminder.backup.BackupCommitResult
import com.aslam.mediareminder.backup.BackupExporter
import com.aslam.mediareminder.backup.BackupFormatException
import com.aslam.mediareminder.backup.BackupImporter
import com.aslam.mediareminder.backup.BackupOperationRegistry
import com.aslam.mediareminder.capability.CapabilitySnapshotProvider
import com.aslam.mediareminder.data.DynamicColorProvider
import com.aslam.mediareminder.data.PreferencesRepository
import com.aslam.mediareminder.data.ReminderProfileSeed
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.diagnostics.NativeLogger
import com.aslam.mediareminder.media.MediaLibraryService
import com.aslam.mediareminder.notifications.NotificationCoordinator
import com.aslam.mediareminder.reminders.ActionResultWriter
import com.aslam.mediareminder.reminders.ReminderDtoWriter
import com.aslam.mediareminder.reminders.ReminderMutationService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * The `MediaReminder` TurboModule (MR-08 "Native module surface").
 *
 * Registered by hand through [MediaReminderPackage] rather than a
 * Codegen-generated `Spec` base class: this environment has no Android SDK to
 * run `generateCodegenArtifactsFromSchema` against, so the module implements
 * [TurboModule] directly against the same method surface declared in
 * `src/native-client/NativeMediaReminder.ts`. Wiring `codegenConfig` in
 * `package.json` and switching to the generated `NativeMediaReminderSpec`
 * base class is a mechanical follow-up once a real Gradle build is available
 * to verify it — the method names, argument shapes and promise semantics
 * below already match what Codegen would produce.
 *
 * MR-18: "Coroutines with structured concurrency; no GlobalScope... Receivers
 * call goAsync() and finish within bounded work." This module owns one scope
 * tied to its own lifecycle ([invalidate]) rather than `GlobalScope`.
 */
class MediaReminderModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext), TurboModule {

    private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val preferences = PreferencesRepository(reactContext)
    private val database = MediaReminderDatabase.getInstance(reactContext)
    private val reminderMutations = ReminderMutationService(reactContext, database)
    private val mediaLibrary = MediaLibraryService(database)

    init {
        // MR-11 "Crash during replace": "Startup sees operation journal...
        // completes rollback/forward recovery." The module is instantiated
        // once, early in the RN host's lifecycle, before any backup bridge
        // method can be called — this always runs ahead of a fresh
        // export/import request.
        moduleScope.launch {
            runCatching {
                BackupImporter(reactContext, database, preferences).recoverUnfinishedOnStartup()
            }.onFailure { NativeLogger.error("backup.startupRecoveryFailed", cause = it) }
        }

        // MR-09 "Data retention" (ADR-007: swept opportunistically at
        // startup/on next write, never a background schedule — these three
        // DAO methods existed but were never called until now). A separate
        // runCatching from the recovery block above, so a failure here can
        // never block backup crash-recovery.
        moduleScope.launch {
            runCatching {
                val now = System.currentTimeMillis()
                database.idempotencyDao().deleteExpired(now)
                database.occurrenceDao().deleteResolvedBefore(now - OCCURRENCE_RETENTION_MS)
                // OperationJournalEntity's doc: rows are "retained briefly
                // after COMPLETE" — matched to the shortest idempotency
                // scope (alarm_action, 7 days) rather than the longer
                // backup_commit window, since a finished journal row's only
                // purpose is querying a just-finished operation's result.
                database.operationJournalDao().deleteFinishedBefore(now - OPERATION_JOURNAL_RETENTION_MS)
            }.onFailure { NativeLogger.error("retention.sweepFailed", cause = it) }
        }
    }

    override fun getName(): String = NAME

    // --- Implemented in the foundation -----------------------------------

    @ReactMethod
    fun getStartupSnapshot(promise: Promise) {
        moduleScope.launch {
            val capability = CapabilitySnapshotProvider.snapshot(reactApplicationContext)
            // The reminder engine has been real since the recurrence-engine
            // slice (docs/decision-log.md DL-005 onward) — `activeReminderCount`
            // and `nextOccurrence` previously stayed hardcoded at their
            // pre-Room placeholder values from this module's very first
            // foundation slice and were never updated, which meant
            // `TodayScreen`'s `hasReminders` check (`activeReminderCount > 0`)
            // could never be true on a real device. `mediaCount` genuinely
            // stays 0 — no media table exists yet (DL-012).
            val activeReminderCount = database.reminderDao().countEnabled()
            val nextOccurrence = database.occurrenceDao().getEarliestEligible()
            val snapshot: WritableMap = Arguments.createMap().apply {
                putInt("contractVersion", 1)
                putInt("schemaVersion", 1)
                putString("appVersion", BuildConfig.VERSION_NAME)
                putString("buildVariant", BuildVariant.current)
                putInt("mediaCount", 0)
                putInt("activeReminderCount", activeReminderCount)
                if (nextOccurrence != null) putMap("nextOccurrence", ReminderDtoWriter.writeOccurrence(nextOccurrence)) else putNull("nextOccurrence")
                putMap("capability", capability)
                putMap(
                    "repair",
                    Arguments.createMap().apply {
                        putBoolean("inProgress", false)
                        putInt("pendingOperations", 0)
                    },
                )
                putNull("activeSession")
                putString("sequence", "1")
            }
            promise.resolve(snapshot)
        }
    }

    @ReactMethod
    fun getCapabilitySnapshot(promise: Promise) {
        promise.resolve(CapabilitySnapshotProvider.snapshot(reactApplicationContext))
    }

    @ReactMethod
    fun getPreferences(promise: Promise) {
        moduleScope.launch {
            promise.resolve(preferences.read())
        }
    }

    @ReactMethod
    fun setPreferences(patch: ReadableMap, promise: Promise) {
        moduleScope.launch {
            // MR-07 observability event; no values logged, only which keys
            // changed — a theme preference is not sensitive, but the pattern
            // of "keys only, never values" is the one every future write path
            // in this module should follow.
            NativeLogger.debug("preferences.write", mapOf("keys" to patch.toHashMap().keys.joinToString(",")))
            promise.resolve(preferences.write(patch))
        }
    }

    @ReactMethod
    fun getDynamicColorScheme(promise: Promise) {
        // `resolve(null)` is a valid, distinct outcome here — it is exactly
        // how `decodeDynamicColorPayload()` on the JS side is told "fall
        // back to the brand palette" (API < 31 or an OEM that omits a ramp).
        promise.resolve(DynamicColorProvider.read(reactApplicationContext))
    }

    @ReactMethod
    fun listMedia(query: ReadableMap, promise: Promise) {
        moduleScope.launch {
            runCatching { mediaLibrary.listMedia(mediaLibrary.criteriaFrom(query)) }
                .onSuccess { promise.resolve(it) }
                .onFailure { error ->
                    // An unsupported `sort` is the caller sending a value
                    // outside the MR-08 enum, which is a validation fault, not
                    // an internal one — reporting it as failed-safe would hide
                    // a JS bug behind a generic "something went wrong".
                    if (error is IllegalArgumentException) {
                        NativeErrorEnvelope.reject(
                            promise = promise,
                            code = "MR_VALIDATION_FAILED",
                            messageKey = "error.validationFailed",
                            category = NativeErrorEnvelope.Category.VALIDATION,
                            field = "sort",
                        )
                    } else {
                        failSafe(promise, error, "listMedia")
                    }
                }
        }
    }

    @ReactMethod
    fun listReminders(promise: Promise) {
        moduleScope.launch {
            runCatching { reminderMutations.list() }
                .onSuccess { promise.resolve(it) }
                .onFailure { failSafe(promise, it, "listReminders") }
        }
    }

    @ReactMethod
    fun listProfiles(promise: Promise) {
        promise.resolve(ReminderProfileSeed.asWritableArray())
    }

    // --- Media/profile/backup: still declared contract, not yet implemented ---
    // The reminder-engine slice (docs/decision-log.md) implemented
    // getReminder/saveReminder/setReminderEnabled/deleteReminder/
    // scheduleTestReminder/playDueSession/snoozeDueSession/dismissDueSession
    // above for real; media import, user-defined profiles and backup/restore
    // remain out of scope. `listMedia`/`getMedia` above are now real (the
    // media library read side, backed by Room `media_assets`); the *write*
    // side below — import, update, delete — is still pending.
    // Every method below rejects with the same envelope the JS mock uses
    // (`mockNativeModule.ts`'s `notImplemented`), so a screen built against
    // this module today and against the mock tomorrow behaves identically.

    @ReactMethod
    fun getMedia(id: String, promise: Promise) {
        moduleScope.launch {
            runCatching { mediaLibrary.getMedia(id) }
                .onSuccess { detail ->
                    if (detail != null) {
                        promise.resolve(detail)
                    } else {
                        // MR-08 `MR_MEDIA_UNAVAILABLE`: the id does not resolve
                        // to a row. Distinct from a failed-safe internal error
                        // so the UI can show "this item is gone" rather than a
                        // retry prompt.
                        NativeErrorEnvelope.reject(
                            promise = promise,
                            code = "MR_MEDIA_UNAVAILABLE",
                            messageKey = "error.mediaUnavailable",
                            category = NativeErrorEnvelope.Category.MEDIA,
                            field = "id",
                        )
                    }
                }
                .onFailure { failSafe(promise, it, "getMedia") }
        }
    }

    @ReactMethod
    fun beginMediaImport(request: ReadableMap, promise: Promise) =
        NativeErrorEnvelope.rejectNotImplemented(promise, "beginMediaImport")

    @ReactMethod
    fun updateMedia(request: ReadableMap, promise: Promise) =
        NativeErrorEnvelope.rejectNotImplemented(promise, "updateMedia")

    @ReactMethod
    fun deleteMedia(request: ReadableMap, promise: Promise) =
        NativeErrorEnvelope.rejectNotImplemented(promise, "deleteMedia")

    @ReactMethod
    fun getReminder(id: String, promise: Promise) {
        moduleScope.launch {
            runCatching { reminderMutations.get(id) }
                .onSuccess { result ->
                    if (result != null) {
                        promise.resolve(result)
                    } else {
                        NativeErrorEnvelope.reject(
                            promise, "MR_VALIDATION_FAILED", "error.unexpected",
                            NativeErrorEnvelope.Category.VALIDATION, field = "id",
                        )
                    }
                }
                .onFailure { failSafe(promise, it, "getReminder") }
        }
    }

    @ReactMethod
    fun saveReminder(request: ReadableMap, promise: Promise) {
        moduleScope.launch {
            runCatching { reminderMutations.save(request) }
                .onSuccess { outcome ->
                    when (outcome) {
                        is ReminderMutationService.SaveOutcome.Success -> promise.resolve(outcome.result)
                        is ReminderMutationService.SaveOutcome.Invalid ->
                            NativeErrorEnvelope.reject(
                                promise, "MR_VALIDATION_FAILED", "error.unexpected",
                                NativeErrorEnvelope.Category.VALIDATION, field = outcome.field,
                            )
                        ReminderMutationService.SaveOutcome.Conflict ->
                            NativeErrorEnvelope.reject(
                                promise, "MR_VALIDATION_FAILED", "error.unexpected",
                                NativeErrorEnvelope.Category.VALIDATION, retryable = true, field = "entityVersion",
                            )
                    }
                }
                .onFailure { failSafe(promise, it, "saveReminder") }
        }
    }

    @ReactMethod
    fun setReminderEnabled(id: String, enabled: Boolean, promise: Promise) {
        moduleScope.launch {
            runCatching { reminderMutations.setEnabled(id, enabled) }
                .onSuccess { outcome ->
                    when (outcome) {
                        is ReminderMutationService.EnableOutcome.Success -> promise.resolve(outcome.result)
                        ReminderMutationService.EnableOutcome.NotFound ->
                            NativeErrorEnvelope.reject(
                                promise, "MR_VALIDATION_FAILED", "error.unexpected",
                                NativeErrorEnvelope.Category.VALIDATION, field = "id",
                            )
                    }
                }
                .onFailure { failSafe(promise, it, "setReminderEnabled") }
        }
    }

    @ReactMethod
    fun deleteReminder(id: String, promise: Promise) {
        moduleScope.launch {
            runCatching { reminderMutations.delete(id) }
                .onSuccess { promise.resolve(it) }
                .onFailure { failSafe(promise, it, "deleteReminder") }
        }
    }

    @ReactMethod
    fun saveProfile(request: ReadableMap, promise: Promise) =
        NativeErrorEnvelope.rejectNotImplemented(promise, "saveProfile")

    @ReactMethod
    fun resetBuiltInProfile(id: String, promise: Promise) =
        NativeErrorEnvelope.rejectNotImplemented(promise, "resetBuiltInProfile")

    @ReactMethod
    fun openCapabilitySettings(kind: String, promise: Promise) =
        NativeErrorEnvelope.rejectNotImplemented(promise, "openCapabilitySettings")

    @ReactMethod
    fun scheduleTestReminder(mode: String, promise: Promise) {
        // `mode` (locked/unlocked) selects which adaptive-presentation path
        // MR-06 wants exercised; the locked/full-screen path itself is out
        // of scope for this pass (see `NotificationCoordinator`'s scope
        // note), so every mode currently produces the same notification.
        // Accepting and ignoring the parameter — rather than rejecting it —
        // keeps the JS call site stable for when that path lands.
        runCatching { reminderMutations.scheduleTest() }
            .onSuccess { promise.resolve(it) }
            .onFailure { failSafe(promise, it, "scheduleTestReminder") }
    }

    @ReactMethod
    fun beginExport(request: ReadableMap, promise: Promise) {
        val operationId = UUID.randomUUID().toString()
        BackupOperationRegistry.register(operationId)
        moduleScope.launch {
            try {
                val exporter = BackupExporter(reactApplicationContext, database, preferences)
                val outcome = exporter.export(
                    onProgress = { progress ->
                        BackupOperationEmitter.emit(reactApplicationContext, operationId, "export", progress, cancellable = true)
                    },
                    isCancelled = { BackupOperationRegistry.isCancelled(operationId) },
                )
                promise.resolve(BackupDtoWriter.writeExportResult(outcome))
            } catch (cancelled: BackupCancelledException) {
                NativeErrorEnvelope.reject(
                    promise, "MR_VALIDATION_FAILED", "error.unexpected",
                    NativeErrorEnvelope.Category.INTERNAL, field = "cancelled",
                )
            } catch (formatError: BackupFormatException) {
                NativeErrorEnvelope.reject(
                    promise, "MR_BACKUP_EXPORT_FAILED", "error.unexpected",
                    NativeErrorEnvelope.Category.BACKUP, field = formatError.reasonCode,
                )
            } catch (error: Exception) {
                failSafe(promise, error, "beginExport")
            } finally {
                BackupOperationRegistry.clear(operationId)
                BackupOperationEmitter.clear(operationId)
            }
        }
    }

    /**
     * `uriToken` is a `content://`/`file://` URI string (from whatever
     * document-picker flow the JS side uses to let the user choose a file —
     * the picker UI itself is a documented follow-up, see docs/decision-log.md).
     * `ContentResolver.openInputStream` accepts either scheme directly.
     */
    @ReactMethod
    fun inspectBackup(uriToken: String, promise: Promise) {
        val operationId = UUID.randomUUID().toString()
        BackupOperationRegistry.register(operationId)
        moduleScope.launch {
            try {
                val importer = BackupImporter(reactApplicationContext, database, preferences)
                importer.stage(operationId, uriToken) { progress ->
                    BackupOperationEmitter.emit(reactApplicationContext, operationId, "backup_inspection", progress, cancellable = true)
                }
                val inspection = importer.inspect(operationId) { progress ->
                    BackupOperationEmitter.emit(reactApplicationContext, operationId, "backup_inspection", progress, cancellable = true)
                }
                promise.resolve(BackupDtoWriter.writeInspection(inspection))
            } catch (formatError: BackupFormatException) {
                NativeErrorEnvelope.reject(
                    promise, "MR_VALIDATION_FAILED", "error.unexpected",
                    NativeErrorEnvelope.Category.BACKUP, field = formatError.reasonCode,
                )
            } catch (error: Exception) {
                failSafe(promise, error, "inspectBackup")
            } finally {
                BackupOperationRegistry.clear(operationId)
            }
        }
    }

    /** `request` carries `{operationId, importToken, mode}` — `mode` is `inspect` | `merge` | `replace` (MR-10 "Import modes"). */
    @ReactMethod
    fun commitImport(request: ReadableMap, promise: Promise) {
        val operationId = request.getString("operationId")
        val importToken = request.getString("importToken")
        val mode = request.getString("mode")
        if (operationId == null || importToken == null) {
            NativeErrorEnvelope.reject(
                promise, "MR_VALIDATION_FAILED", "error.unexpected",
                NativeErrorEnvelope.Category.VALIDATION, field = "operationId",
            )
            return
        }
        // Bug fix: a missing/unrecognized `mode` used to default silently to
        // "merge" — a caller bug (JS forgot to send it, or a future mode
        // string this native side doesn't know yet) would mutate the user's
        // data under a mode they never actually requested, instead of
        // failing loudly. `mode` is required and validated against the known
        // enum, same as `operationId`/`importToken` above.
        if (mode == null || mode !in KNOWN_IMPORT_MODES) {
            NativeErrorEnvelope.reject(
                promise, "MR_VALIDATION_FAILED", "error.unexpected",
                NativeErrorEnvelope.Category.VALIDATION, field = "mode",
            )
            return
        }
        if (mode == "inspect") {
            // MR-10 "Inspect only": "No mutation." — nothing to commit.
            // (JS-side `ImportMode` already uses `'inspect'` — kept
            // identical here rather than introducing a second spelling.)
            promise.resolve(BackupDtoWriter.writeCommitResult(BackupCommitResult(status = "ok", affectedCount = 0)))
            return
        }
        moduleScope.launch {
            try {
                val importer = BackupImporter(reactApplicationContext, database, preferences)
                val result = importer.commit(operationId, importToken, mode)
                promise.resolve(BackupDtoWriter.writeCommitResult(result))
            } catch (formatError: BackupFormatException) {
                NativeErrorEnvelope.reject(
                    promise, "MR_VALIDATION_FAILED", "error.unexpected",
                    NativeErrorEnvelope.Category.BACKUP, field = formatError.reasonCode,
                )
            } catch (error: Exception) {
                failSafe(promise, error, "commitImport")
            } finally {
                BackupOperationRegistry.clear(operationId)
                BackupOperationEmitter.clear(operationId)
            }
        }
    }

    @ReactMethod
    fun cancelOperation(id: String, promise: Promise) {
        BackupOperationRegistry.requestCancellation(id)
        BackupImporter(reactApplicationContext, database, preferences).cancel(id)
        promise.resolve(
            Arguments.createMap().apply {
                putString("status", "ok")
                putInt("affectedCount", 0)
            },
        )
    }

    @ReactMethod
    fun playDueSession(sessionId: String, nonce: String, promise: Promise) =
        resolveAlarmAction(AlarmIds.ACTION_PLAY, sessionId, nonce, null, promise)

    @ReactMethod
    fun snoozeDueSession(sessionId: String, minutes: Double, nonce: String, promise: Promise) =
        resolveAlarmAction(AlarmIds.ACTION_SNOOZE, sessionId, nonce, minutes.toInt(), promise)

    @ReactMethod
    fun dismissDueSession(sessionId: String, nonce: String, promise: Promise) =
        resolveAlarmAction(AlarmIds.ACTION_DISMISS, sessionId, nonce, null, promise)

    /**
     * The in-app counterpart to [com.aslam.mediareminder.alarm.AlarmActionReceiver]'s
     * notification-tap handling — both share [AlarmActionProcessor] so
     * AND-002 ("Play/Snooze/Dismiss work with RN disabled") and the in-app
     * path can never silently diverge in behavior.
     */
    private fun resolveAlarmAction(
        action: String,
        sessionId: String,
        nonce: String,
        requestedSnoozeMinutes: Int?,
        promise: Promise,
    ) {
        moduleScope.launch {
            runCatching { AlarmActionProcessor.process(database, action, sessionId, nonce, requestedSnoozeMinutes) }
                .onSuccess { outcome ->
                    when (outcome) {
                        is AlarmActionProcessor.Outcome.UnknownSession ->
                            NativeErrorEnvelope.reject(
                                promise, "MR_VALIDATION_FAILED", "error.unexpected",
                                NativeErrorEnvelope.Category.VALIDATION, field = "sessionId",
                            )

                        AlarmActionProcessor.Outcome.AlreadyResolved ->
                            promise.resolve(ActionResultWriter.write(sessionId, "already_resolved", null))

                        is AlarmActionProcessor.Outcome.Resolved -> {
                            NotificationCoordinator(reactApplicationContext).cancel(sessionId)
                            AlarmRingingService.stopSession(reactApplicationContext, sessionId)
                            SchedulerCoordinator(reactApplicationContext, database)
                                .reconcile("alarm_action_${outcome.actionLabel}")
                            val actionOutcome = when (outcome.actionLabel) {
                                "play" -> "playing"
                                "snooze" -> "snoozed"
                                else -> "dismissed"
                            }
                            val nextOccurrence = database.occurrenceDao().getPendingForReminder(outcome.reminderId)
                            promise.resolve(
                                ActionResultWriter.write(sessionId, actionOutcome, outcome.snoozedUntilEpochMs, nextOccurrence),
                            )
                        }
                    }
                }
                .onFailure { failSafe(promise, it, "resolveAlarmAction:$action") }
        }
    }

    private fun failSafe(promise: Promise, error: Throwable, method: String) {
        NativeLogger.error("bridge.failedSafe", mapOf("method" to method), cause = error)
        NativeErrorEnvelope.reject(
            promise = promise,
            code = "MR_INTERNAL_FAILED_SAFE",
            messageKey = "error.unexpected",
            category = NativeErrorEnvelope.Category.INTERNAL,
            retryable = false,
            field = method,
        )
    }

    override fun invalidate() {
        // MR-18: every scope has a bounded, deterministic teardown. Cancelling
        // here means an in-flight DataStore read simply never resolves its
        // promise rather than touching a torn-down ReactContext.
        moduleScope.cancel()
        super.invalidate()
    }

    companion object {
        const val NAME = "MediaReminder"

        /** MR-09 "Data retention": occurrence history defaults to 90 days. */
        private const val OCCURRENCE_RETENTION_MS = 90L * 24 * 60 * 60 * 1000

        /** See the retention-sweep comment in [init] for why this is 7 days, not [IdempotencyRecordEntity]'s longer backup_commit window. */
        private const val OPERATION_JOURNAL_RETENTION_MS = 7L * 24 * 60 * 60 * 1000

        /** MR-10 "Import modes" — the only values `commitImport`'s `mode` field may carry. */
        private val KNOWN_IMPORT_MODES = setOf("inspect", "merge", "replace")
    }
}
