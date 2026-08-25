package com.aslam.mediareminder.bridge

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import android.provider.Settings
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.turbomodule.core.interfaces.TurboModule
import com.aslam.mediareminder.BuildConfig
import com.aslam.mediareminder.alarm.AlarmActionProcessor
import com.aslam.mediareminder.alarm.AlarmIds
import com.aslam.mediareminder.statistics.StatisticsProvider
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
import com.aslam.mediareminder.media.MediaDtoWriter
import com.aslam.mediareminder.media.MediaImportCancelledException
import com.aslam.mediareminder.media.MediaImportException
import com.aslam.mediareminder.media.MediaImporter
import com.aslam.mediareminder.media.MediaLibraryService
import com.aslam.mediareminder.media.MediaPicker
import com.aslam.mediareminder.media.MediaStorage
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
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

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
) : ReactContextBaseJavaModule(reactContext), TurboModule, ActivityEventListener {

    private val moduleScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val preferences = PreferencesRepository(reactContext)
    private val database = MediaReminderDatabase.getInstance(reactContext)
    private val reminderMutations = ReminderMutationService(reactContext, database)
    private val mediaLibrary = MediaLibraryService(database, MediaStorage(reactContext))

    /**
     * [pickDocument]'s in-flight promises, keyed by the `startActivityForResult`
     * request code that will resolve them.
     *
     * A plain map, not a coroutine continuation: `Promise.resolve`/`.reject`
     * can be called from any callback context RN's bridge threads it through,
     * so there is nothing here that needs `suspendCancellableCoroutine` — only
     * a place to find the right promise when [onActivityResult] fires.
     */
    private val pendingPickers = ConcurrentHashMap<Int, Promise>()
    private val nextPickerRequestCode = AtomicInteger(PICKER_REQUEST_CODE_BASE)

    /** Separate counter from [nextPickerRequestCode] so a permission request in flight can never collide with a picker's `onActivityResult` request code. */
    private val nextPermissionRequestCode = AtomicInteger(PERMISSION_REQUEST_CODE_BASE)

    init {
        // ADR-011: the Photo Picker/SAF result arrives through the hosting
        // Activity's `onActivityResult`, not through this module directly —
        // this is what lets `onActivityResult` below ever fire.
        reactContext.addActivityEventListener(this)

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

        // Self-heals library rows imported before thumbnail generation
        // existed (see `MediaLibraryService.backfillMissingThumbnails`'s
        // doc) — a separate `runCatching` so a failure here can't block
        // either sweep above.
        moduleScope.launch {
            runCatching { mediaLibrary.backfillMissingThumbnails() }
                .onFailure { NativeLogger.error("media.thumbnailBackfillFailed", cause = it) }
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

    /**
     * ADR-011 "Use system pickers": launches the Photo Picker (visual-only
     * `mimeTypes`, API 33+) or the SAF document picker (everything else,
     * chosen by [MediaPicker]) and resolves once the user has made a choice
     * — with `null`, not a rejection, when they back out with none. Separate
     * from [beginMediaImport] deliberately: picking is a quick, one-shot UI
     * interaction with no meaningful progress to report, while importing is
     * the (potentially large, potentially long) streamed copy. Splitting them
     * means [beginMediaImport] never needs Activity access at all.
     */
    @ReactMethod
    fun pickDocument(mimeTypes: ReadableArray, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            NativeErrorEnvelope.reject(
                promise, "MR_MEDIA_UNAVAILABLE", "error.mediaUnavailable",
                NativeErrorEnvelope.Category.MEDIA, field = "activity",
            )
            return
        }

        val types = (0 until mimeTypes.size()).mapNotNull { mimeTypes.getString(it) }
        val intent = MediaPicker.buildIntent(types)
        val requestCode = nextPickerRequestCode.getAndIncrement()
        pendingPickers[requestCode] = promise
        try {
            activity.startActivityForResult(intent, requestCode)
        } catch (error: Exception) {
            pendingPickers.remove(requestCode)
            NativeErrorEnvelope.reject(
                promise, "MR_MEDIA_UNAVAILABLE", "error.mediaUnavailable",
                NativeErrorEnvelope.Category.MEDIA, field = "picker",
            )
        }
    }

    /**
     * MR-05 "Import transaction". Resolves once the whole file is copied,
     * hashed, probed and inserted — the same "no large stream to justify a
     * fire-and-forget `OperationRef`" reasoning [beginExport]'s own comment
     * gives does not hold here (a media file genuinely can be large), so
     * unlike that method this one *does* stream `operationProgress` events
     * throughout, tagged `kind: "import"`; the JS side learns `operationId`
     * from the first such event, the same way it already does for backup
     * export/inspection, and can pass it to `cancelOperation`.
     *
     * `request.sourceUri` must come from a prior [pickDocument] call in this
     * same app session — ADR-011 keeps this app from requesting persistable
     * URI permissions, so the transient read grant SAF/the Photo Picker
     * attaches to the result is only guaranteed to still be valid promptly
     * after picking, not indefinitely.
     */
    @ReactMethod
    fun beginMediaImport(request: ReadableMap, promise: Promise) {
        val sourceUri = request.getString("sourceUri")
        if (sourceUri.isNullOrBlank()) {
            NativeErrorEnvelope.reject(
                promise, "MR_VALIDATION_FAILED", "error.validationFailed",
                NativeErrorEnvelope.Category.VALIDATION, field = "sourceUri",
            )
            return
        }
        val mimeType = if (request.hasKey("mimeType")) request.getString("mimeType") else null
        val displayName = if (request.hasKey("displayName")) request.getString("displayName") else null
        val declaredSizeBytes = if (request.hasKey("sizeBytes")) {
            request.getString("sizeBytes")?.toLongOrNull()
        } else {
            null
        }

        val operationId = UUID.randomUUID().toString()
        OperationRegistry.register(operationId)
        moduleScope.launch {
            try {
                val importerStorage = MediaStorage(reactApplicationContext)
                val importer = MediaImporter(reactApplicationContext, database, importerStorage)
                val asset = importer.import(
                    operationId = operationId,
                    sourceUri = sourceUri,
                    displayName = displayName,
                    mimeType = mimeType,
                    declaredSizeBytes = declaredSizeBytes,
                    onProgress = { phase, completedBytes, totalBytes ->
                        OperationProgressEmitter.emit(
                            context = reactApplicationContext,
                            operationId = operationId,
                            kind = "import",
                            phase = phase,
                            cancellable = true,
                            completedBytes = completedBytes,
                            totalBytes = totalBytes,
                        )
                    },
                    isCancelled = { OperationRegistry.isCancelled(operationId) },
                )
                // A freshly imported asset cannot yet be referenced by any
                // reminder — `activeReminderCount` is always 0 here, not a
                // placeholder; the real count only exists once a reminder is
                // saved against it.
                promise.resolve(MediaDtoWriter.writeDetail(asset, activeReminderCount = 0, importerStorage))
            } catch (cancelled: MediaImportCancelledException) {
                NativeErrorEnvelope.reject(
                    promise, "MR_VALIDATION_FAILED", "error.unexpected",
                    NativeErrorEnvelope.Category.INTERNAL, field = "cancelled",
                )
            } catch (mediaError: MediaImportException) {
                val (code, category, messageKey) = mediaImportErrorEnvelope(mediaError.reasonCode)
                NativeErrorEnvelope.reject(promise, code, messageKey, category, field = mediaError.reasonCode)
            } catch (error: Exception) {
                failSafe(promise, error, "beginMediaImport")
            } finally {
                OperationRegistry.clear(operationId)
                OperationProgressEmitter.clear(operationId)
            }
        }
    }

    /** MR-03 "Edit details": rename and/or edit notes for an existing media item. */
    @ReactMethod
    fun updateMedia(request: ReadableMap, promise: Promise) {
        moduleScope.launch {
            runCatching { mediaLibrary.updateMedia(request) }
                .onSuccess { outcome ->
                    when (outcome) {
                        is MediaLibraryService.UpdateMediaOutcome.Success -> promise.resolve(outcome.detail)
                        is MediaLibraryService.UpdateMediaOutcome.NotFound -> NativeErrorEnvelope.reject(
                            promise, "MR_MEDIA_UNAVAILABLE", "error.mediaUnavailable",
                            NativeErrorEnvelope.Category.MEDIA, field = "id",
                        )
                        is MediaLibraryService.UpdateMediaOutcome.Invalid -> NativeErrorEnvelope.reject(
                            promise, "MR_VALIDATION_FAILED", "error.validationFailed",
                            NativeErrorEnvelope.Category.VALIDATION, field = outcome.field,
                        )
                        // A stale-version race on a single-user rename dialog is
                        // vanishingly rare and not user-actionable beyond "try
                        // again" — failed-safe, not a bespoke conflict code.
                        is MediaLibraryService.UpdateMediaOutcome.Conflict -> failSafe(
                            promise, IllegalStateException("media entity_version conflict"), "updateMedia",
                        )
                    }
                }
                .onFailure { failSafe(promise, it, "updateMedia") }
        }
    }

    /**
     * MR-03 "Delete": removes the asset's DB row plus its on-disk file and
     * cached thumbnail (`MediaLibraryService.deleteMedia`). `media_id` on
     * `reminders` carries no FK (see `ReminderEntity`'s doc comment), so
     * nothing at the DB layer forces a decision about attached reminders —
     * `cascadeDeleteReminders` is what the JS confirm dialog's two
     * destructive choices actually select between: `true` deletes each
     * attached reminder the same way `deleteReminder` would (alarm
     * rescheduling and schedule-rule/occurrence cleanup included); `false`
     * only disables them, leaving an inert reminder whose joined media is
     * now null — a case `ReminderDtoWriter` already treats as a null-safe
     * fallback rather than a crash.
     */
    @ReactMethod
    fun deleteMedia(request: ReadableMap, promise: Promise) {
        moduleScope.launch {
            runCatching {
                val id = request.takeIf { it.hasKey("id") }?.getString("id")
                val cascade = request.hasKey("cascadeDeleteReminders") &&
                    request.getBoolean("cascadeDeleteReminders")

                if (id != null) {
                    for (reminderId in mediaLibrary.attachedReminderIds(id)) {
                        if (cascade) {
                            reminderMutations.delete(reminderId)
                        } else {
                            reminderMutations.setEnabled(reminderId, false)
                        }
                    }
                }

                mediaLibrary.deleteMedia(request)
            }
                .onSuccess { outcome ->
                    when (outcome) {
                        is MediaLibraryService.DeleteMediaOutcome.Success -> promise.resolve(
                            Arguments.createMap().apply {
                                putString("status", "ok")
                                putInt("affectedCount", 1)
                            },
                        )
                        is MediaLibraryService.DeleteMediaOutcome.NotFound -> NativeErrorEnvelope.reject(
                            promise, "MR_MEDIA_UNAVAILABLE", "error.mediaUnavailable",
                            NativeErrorEnvelope.Category.MEDIA, field = "id",
                        )
                        is MediaLibraryService.DeleteMediaOutcome.Invalid -> NativeErrorEnvelope.reject(
                            promise, "MR_VALIDATION_FAILED", "error.validationFailed",
                            NativeErrorEnvelope.Category.VALIDATION, field = outcome.field,
                        )
                    }
                }
                .onFailure { failSafe(promise, it, "deleteMedia") }
        }
    }

    /**
     * Library "Export selected" — see `MediaLibraryService.buildExportIntent`'s
     * doc for why this opens the OS share sheet rather than writing an
     * archive. Needs `currentActivity` the same way `pickDocument` does, but
     * fire-and-forget (`startActivity`, not `startActivityForResult`): unlike
     * a picker, nothing meaningful comes back from a share chooser to await.
     */
    @ReactMethod
    fun exportMediaAssets(ids: ReadableArray, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            NativeErrorEnvelope.reject(
                promise, "MR_MEDIA_UNAVAILABLE", "error.mediaUnavailable",
                NativeErrorEnvelope.Category.MEDIA, field = "activity",
            )
            return
        }

        val idList = (0 until ids.size()).mapNotNull { ids.getString(it) }
        moduleScope.launch {
            runCatching { mediaLibrary.buildExportIntent(idList) }
                .onSuccess { intent ->
                    if (intent == null) {
                        NativeErrorEnvelope.reject(
                            promise, "MR_MEDIA_UNAVAILABLE", "error.mediaUnavailable",
                            NativeErrorEnvelope.Category.MEDIA, field = "ids",
                        )
                        return@onSuccess
                    }
                    try {
                        activity.startActivity(Intent.createChooser(intent, null))
                        promise.resolve(
                            Arguments.createMap().apply {
                                putString("status", "ok")
                                putInt("affectedCount", idList.size)
                            },
                        )
                    } catch (error: Exception) {
                        failSafe(promise, error, "exportMediaAssets")
                    }
                }
                .onFailure { failSafe(promise, it, "exportMediaAssets") }
        }
    }

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

    /**
     * Triggers the real OS "Allow notifications?" dialog (MR-06 capability
     * state machine, `notifications` capability's `request_runtime` action) —
     * previously nothing in this bridge ever called
     * [PermissionAwareActivity.requestPermissions], so a user who denied (or
     * was never asked) at first install had no way to be re-prompted short of
     * finding the OS Settings screen themselves.
     *
     * `POST_NOTIFICATIONS` only exists as a runtime permission from API 33
     * (Tiramisu) onward — earlier versions have notifications enabled by
     * default with no separate grant step, so this resolves `granted: true`
     * immediately rather than asking for a permission that does not exist.
     */
    @ReactMethod
    fun requestNotificationPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            promise.resolve(Arguments.createMap().apply { putBoolean("granted", true) })
            return
        }

        val alreadyGranted = ContextCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
        if (alreadyGranted) {
            promise.resolve(Arguments.createMap().apply { putBoolean("granted", true) })
            return
        }

        val activity = reactApplicationContext.currentActivity as? PermissionAwareActivity
        if (activity == null) {
            NativeErrorEnvelope.reject(
                promise, "MR_MEDIA_UNAVAILABLE", "error.mediaUnavailable",
                NativeErrorEnvelope.Category.MEDIA, field = "activity",
            )
            return
        }

        val requestCode = nextPermissionRequestCode.getAndIncrement()
        activity.requestPermissions(
            arrayOf(Manifest.permission.POST_NOTIFICATIONS),
            requestCode,
        ) { _, _, grantResults ->
            val granted = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
            promise.resolve(Arguments.createMap().apply { putBoolean("granted", granted) })
            true
        }
    }

    /**
     * MR-06 `open_special_access` action: deep-links to the one OS Settings
     * screen for a capability that has no (or no longer usable) in-app
     * runtime dialog — `notifications` after a permanent denial
     * (`requestPermissions` above then silently no-ops instead of showing
     * anything), and `exact_alarm`, which Android never offers a runtime
     * dialog for at all.
     */
    @ReactMethod
    fun openCapabilitySettings(kind: String, promise: Promise) {
        val intent = when (kind) {
            "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                putExtra(Settings.EXTRA_APP_PACKAGE, reactApplicationContext.packageName)
            }
            "exact_alarm" -> Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                data = Uri.parse("package:${reactApplicationContext.packageName}")
            }
            else -> null
        }
        if (intent == null) {
            NativeErrorEnvelope.rejectNotImplemented(promise, "openCapabilitySettings")
            return
        }

        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runCatching { reactApplicationContext.startActivity(intent) }
            .onSuccess { promise.resolve(Arguments.createMap()) }
            .onFailure { failSafe(promise, it, "openCapabilitySettings") }
    }

    /**
     * Drains the one-slot [com.aslam.mediareminder.alarm.PendingMediaOpen]
     * handoff: returns `{mediaId}` when Accept on a full-screen alarm asked
     * for that reminder's media to be opened, `{mediaId: null}` otherwise.
     * JS calls this on mount and on every foreground resume, since a cold
     * launch from the lock screen can mount long after Accept was tapped.
     */
    /**
     * Real Statistics (MR-04 "Charts and history"). `rangeDays` is clamped to
     * the retention window MR-09 defines — asking for more than is retained
     * would silently return a partial range that looks like real data.
     */
    @ReactMethod
    fun getStatistics(rangeDays: Double, promise: Promise) {
        moduleScope.launch {
            runCatching {
                val days = rangeDays.toInt().coerceIn(1, 90)
                StatisticsProvider(database).summarize(days)
            }.onSuccess { summary ->
                val result = Arguments.createMap().apply {
                    putInt("rangeDays", summary.rangeDays)
                    putInt("totalOccurrences", summary.totalOccurrences)
                    putInt("completed", summary.completed)
                    putInt("dismissed", summary.dismissed)
                    putInt("missed", summary.missed)
                    putInt("snoozed", summary.snoozed)
                    if (summary.mostActiveReminderLabel == null) {
                        putNull("mostActiveReminderLabel")
                    } else {
                        putString("mostActiveReminderLabel", summary.mostActiveReminderLabel)
                    }
                    putArray(
                        "dailyBreakdown",
                        Arguments.createArray().apply {
                            summary.dailyBreakdown.forEach { day ->
                                pushMap(
                                    Arguments.createMap().apply {
                                        putString("date", day.date)
                                        putInt("completed", day.completed)
                                        putInt("dismissed", day.dismissed)
                                        putInt("missed", day.missed)
                                    },
                                )
                            }
                        },
                    )
                }
                promise.resolve(result)
            }.onFailure { failSafe(promise, it, "getStatistics") }
        }
    }

    @ReactMethod
    fun takePendingMediaOpen(promise: Promise) {
        val result = Arguments.createMap()
        val pending = com.aslam.mediareminder.alarm.PendingMediaOpen.take()
        if (pending == null) result.putNull("mediaId") else result.putString("mediaId", pending)
        promise.resolve(result)
    }

    /**
     * Settings "Preview alarm styles": `request` carries `title`/`body`
     * (already localized by JS from the tapped profile's own copy) and
     * `fullScreenWhenLocked` (that profile's real field) — this used to take
     * a bare `mode: 'locked' | 'unlocked'` string that nothing ever set to
     * anything but a placeholder, since no caller existed yet; repurposed
     * now that Settings is the first real caller.
     */
    @ReactMethod
    fun scheduleTestReminder(request: ReadableMap, promise: Promise) {
        val title = request.getString("title").orEmpty()
        val body = request.getString("body").orEmpty()
        val fullScreenWhenLocked = request.hasKey("fullScreenWhenLocked") &&
            request.getBoolean("fullScreenWhenLocked")
        runCatching { reminderMutations.scheduleTest(title, body, fullScreenWhenLocked) }
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
     * Backup screen "Share" — see `BackupExporter.buildShareIntent`'s doc;
     * same `currentActivity`-required, fire-and-forget shape as
     * `exportMediaAssets`. `fileName` is `ExportResult.fileName`, already
     * returned to JS by the `beginExport` call this always follows.
     */
    @ReactMethod
    fun shareBackupExport(fileName: String, promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            NativeErrorEnvelope.reject(
                promise, "MR_MEDIA_UNAVAILABLE", "error.mediaUnavailable",
                NativeErrorEnvelope.Category.MEDIA, field = "activity",
            )
            return
        }
        val exporter = BackupExporter(reactApplicationContext, database, preferences)
        runCatching { exporter.buildShareIntent(fileName) }
            .onSuccess { intent ->
                if (intent == null) {
                    NativeErrorEnvelope.reject(
                        promise, "MR_MEDIA_UNAVAILABLE", "error.mediaUnavailable",
                        NativeErrorEnvelope.Category.BACKUP, field = "fileName",
                    )
                    return@onSuccess
                }
                try {
                    activity.startActivity(Intent.createChooser(intent, null))
                    promise.resolve(Arguments.createMap().apply { putString("status", "ok") })
                } catch (error: Exception) {
                    failSafe(promise, error, "shareBackupExport")
                }
            }
            .onFailure { failSafe(promise, it, "shareBackupExport") }
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
        // The shared registry (see its own doc comment): one call site for
        // every operation kind, media import included, not just backup's.
        OperationRegistry.requestCancellation(id)
        // Harmless no-op for an id `BackupImporter` does not recognize —
        // `BackupImporter.cancel()` only logs, it never looks anything up.
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
        reactApplicationContext.removeActivityEventListener(this)
        // A picker left open across module teardown (rare — RN tears the
        // module down on reload/backgrounding, not the system picker dialog)
        // would otherwise leak a promise that never resolves. Reject rather
        // than silently drop it, matching MR-18's "bounded, deterministic
        // teardown" for every in-flight call, not just DataStore reads.
        pendingPickers.keys.toList().forEach { requestCode ->
            pendingPickers.remove(requestCode)?.let { promise ->
                NativeErrorEnvelope.reject(
                    promise, "MR_INTERNAL_FAILED_SAFE", "error.unexpected",
                    NativeErrorEnvelope.Category.INTERNAL, field = "invalidated",
                )
            }
        }
        // MR-18: every scope has a bounded, deterministic teardown. Cancelling
        // here means an in-flight DataStore read simply never resolves its
        // promise rather than touching a torn-down ReactContext.
        moduleScope.cancel()
        super.invalidate()
    }

    // --- ActivityEventListener (ADR-011 picker result delivery) -----------------

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        val promise = pendingPickers.remove(requestCode) ?: return

        if (resultCode != Activity.RESULT_OK || data?.data == null) {
            // The user backed out of the picker with no selection — MR-03's
            // "Import was cancelled. No file was added." is the *expected*
            // outcome of this path, not a failure to report as one.
            promise.resolve(null)
            return
        }

        val uri = data.data!!
        val resolver = reactApplicationContext.contentResolver
        val (displayName, sizeBytes) = queryDisplayNameAndSize(resolver, uri)
        promise.resolve(
            Arguments.createMap().apply {
                putString("uriToken", uri.toString())
                if (displayName != null) putString("displayName", displayName) else putNull("displayName")
                putString("mimeType", resolver.getType(uri) ?: "application/octet-stream")
                if (sizeBytes != null) putString("sizeBytes", sizeBytes.toString()) else putNull("sizeBytes")
            },
        )
    }

    override fun onNewIntent(intent: Intent) = Unit

    private fun queryDisplayNameAndSize(
        resolver: android.content.ContentResolver,
        uri: android.net.Uri,
    ): Pair<String?, Long?> {
        resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                val name = if (nameIndex >= 0) cursor.getString(nameIndex) else null
                val size = if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) cursor.getLong(sizeIndex) else null
                return name to size
            }
        }
        // Some providers omit these columns entirely (rare, but documented
        // ContentResolver behavior) — MediaImporter treats an unknown size as
        // "check only the running hard cap during copy," not as a fault.
        return null to null
    }

    /** Maps a [MediaImportException.reasonCode] to its MR-08 wire code/category. */
    private fun mediaImportErrorEnvelope(reasonCode: String): Triple<String, NativeErrorEnvelope.Category, String> =
        when (reasonCode) {
            MediaImportException.UNSUPPORTED_TYPE ->
                Triple("MR_MEDIA_UNSUPPORTED_TYPE", NativeErrorEnvelope.Category.MEDIA, "error.mediaUnsupportedType")
            MediaImportException.SOURCE_UNREADABLE ->
                Triple("MR_MEDIA_UNAVAILABLE", NativeErrorEnvelope.Category.MEDIA, "error.mediaUnavailable")
            MediaImportException.STORAGE_INSUFFICIENT, MediaImportException.TOO_LARGE ->
                Triple("MR_STORAGE_INSUFFICIENT", NativeErrorEnvelope.Category.STORAGE, "error.storageInsufficient")
            // WRITE_FAILED and anything unrecognized: a genuine internal
            // fault, not a condition the user caused or can act on directly.
            else -> Triple("MR_INTERNAL_FAILED_SAFE", NativeErrorEnvelope.Category.INTERNAL, "error.unexpected")
        }

    companion object {
        const val NAME = "MediaReminder"

        /** MR-09 "Data retention": occurrence history defaults to 90 days. */
        private const val OCCURRENCE_RETENTION_MS = 90L * 24 * 60 * 60 * 1000

        /** See the retention-sweep comment in [init] for why this is 7 days, not [IdempotencyRecordEntity]'s longer backup_commit window. */
        private const val OPERATION_JOURNAL_RETENTION_MS = 7L * 24 * 60 * 60 * 1000

        /** MR-10 "Import modes" — the only values `commitImport`'s `mode` field may carry. */
        private val KNOWN_IMPORT_MODES = setOf("inspect", "merge", "replace")

        /**
         * An arbitrary, distinctive base for `pickDocument`'s
         * `startActivityForResult` codes. `onActivityResult` fires for every
         * `ActivityEventListener` regardless of which one owns a given
         * request code — [pendingPickers] already ignores codes it does not
         * recognize, so this only needs to be unlikely to collide by
         * coincidence, not globally reserved.
         */
        private const val PICKER_REQUEST_CODE_BASE = 9100

        /** Kept well clear of [PICKER_REQUEST_CODE_BASE]'s range so the two request-code spaces can never collide. */
        private const val PERMISSION_REQUEST_CODE_BASE = 9200
    }
}
