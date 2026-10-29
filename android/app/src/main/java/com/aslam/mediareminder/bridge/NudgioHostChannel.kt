package com.aslam.mediareminder.bridge

import android.os.Handler
import android.os.Looper
import com.aslam.mediareminder.BuildConfig
import com.aslam.mediareminder.bridge.wire.Promise
import com.aslam.mediareminder.bridge.wire.ReadableArray
import com.aslam.mediareminder.bridge.wire.ReadableMap
import com.aslam.mediareminder.bridge.wire.WireMap
import com.aslam.mediareminder.bridge.wire.toPlatform
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

/**
 * The `nudgio/host` method channel: decodes each call's named arguments and
 * forwards it to the [MediaReminderModule] method of the same name.
 *
 * The method table and argument keys are `contract/host_methods.json`, which
 * `HostMethodsContractTest` checks against [HostMethods], so a method the
 * Dart client can call but this side does not answer fails CI rather than a
 * phone. Numbers arrive as `Int`/`Long` from Dart and are widened to the
 * `Double` the module's React Native-era signatures take.
 */
class NudgioHostChannel(private val module: MediaReminderModule) : MethodChannel.MethodCallHandler {

    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        val promise = ChannelPromise(result)
        val handler = handlers[call.method]
        if (handler == null) {
            result.notImplemented()
            return
        }
        try {
            handler(call, promise)
        } catch (error: RuntimeException) {
            // A malformed argument (wrong type from a mismatched Dart build) is
            // a validation fault, reported with the envelope, never a crash.
            NativeErrorEnvelope.reject(
                promise, "MR_VALIDATION_FAILED", "error.validationFailed",
                NativeErrorEnvelope.Category.VALIDATION, field = call.method,
            )
        }
    }

    private val handlers: Map<String, (MethodCall, Promise) -> Unit> = mapOf(
        "libraryCommand" to { c, p -> module.libraryCommand(c.string("requestJson"), p) },
        "getStartupSnapshot" to { _, p -> module.getStartupSnapshot(p) },
        "getCapabilitySnapshot" to { _, p -> module.getCapabilitySnapshot(p) },
        "getPreferences" to { _, p -> module.getPreferences(p) },
        "setPreferences" to { c, p -> module.setPreferences(c.map("patch"), p) },
        "getDynamicColorScheme" to { _, p -> module.getDynamicColorScheme(p) },
        "listMedia" to { c, p -> module.listMedia(c.map("query"), p) },
        "getMedia" to { c, p -> module.getMedia(c.string("id"), p) },
        "listProfiles" to { _, p -> module.listProfiles(p) },
        "pickDocument" to { c, p -> module.pickDocument(c.array("mimeTypes"), p) },
        "pickDocuments" to { c, p -> module.pickDocuments(c.array("mimeTypes"), c.number("maxItems"), p) },
        "pickAlarmRingtone" to { c, p -> module.pickAlarmRingtone(c.stringOrNull("currentUri"), p) },
        "previewAlarmRingtone" to { c, p -> module.previewAlarmRingtone(c.stringOrNull("uri"), p) },
        "stopAlarmRingtonePreview" to { _, p -> module.stopAlarmRingtonePreview(p) },
        "listReminders" to { _, p -> module.listReminders(p) },
        "getReminder" to { c, p -> module.getReminder(c.string("id"), p) },
        "saveReminder" to { c, p -> module.saveReminder(c.map("request"), p) },
        "setReminderEnabled" to { c, p -> module.setReminderEnabled(c.string("id"), c.boolean("enabled"), p) },
        "skipNextOccurrence" to { c, p -> module.skipNextOccurrence(c.string("id"), c.boolean("skip"), p) },
        "setPausedUntil" to { c, p -> module.setPausedUntil(c.stringOrNull("until"), p) },
        "takeSharedDocuments" to { _, p -> module.takeSharedDocuments(p) },
        "deleteReminder" to { c, p -> module.deleteReminder(c.string("id"), p) },
        "scheduleTestReminder" to { c, p -> module.scheduleTestReminder(c.map("request"), p) },
        "listRecentlyMissed" to { c, p -> module.listRecentlyMissed(c.number("hours"), p) },
        "playDueSession" to { c, p -> module.playDueSession(c.string("sessionId"), c.string("nonce"), p) },
        "snoozeDueSession" to { c, p ->
            module.snoozeDueSession(c.string("sessionId"), c.number("minutes"), c.string("nonce"), p)
        },
        "dismissDueSession" to { c, p -> module.dismissDueSession(c.string("sessionId"), c.string("nonce"), p) },
        "beginExport" to { c, p -> module.beginExport(c.map("request"), p) },
        "shareBackupExport" to { c, p -> module.shareBackupExport(c.string("fileName"), p) },
        "inspectBackup" to { c, p -> module.inspectBackup(c.string("uriToken"), p) },
        "commitImport" to { c, p -> module.commitImport(c.map("request"), p) },
        "cancelOperation" to { c, p -> module.cancelOperation(c.string("id"), p) },
        "beginMediaImport" to { c, p -> module.beginMediaImport(c.map("request"), p) },
        "updateMedia" to { c, p -> module.updateMedia(c.map("request"), p) },
        "deleteMedia" to { c, p -> module.deleteMedia(c.map("request"), p) },
        "exportMediaAssets" to { c, p -> module.exportMediaAssets(c.array("ids"), p) },
        "shareLibrarySelection" to { c, p ->
            module.shareLibrarySelection(c.array("mediaIds"), c.array("folderIds"), p)
        },
        "saveLibrarySelectionToGallery" to { c, p ->
            module.saveLibrarySelectionToGallery(c.array("mediaIds"), c.array("folderIds"), p)
        },
        "replaceMediaSource" to { c, p -> module.replaceMediaSource(c.map("request"), p) },
        "saveMediaCopyToGallery" to { c, p -> module.saveMediaCopyToGallery(c.string("id"), p) },
        "getMediaStorageUsage" to { _, p -> module.getMediaStorageUsage(p) },
        "requestNotificationPermission" to { _, p -> module.requestNotificationPermission(p) },
        "saveProfile" to { c, p -> module.saveProfile(c.map("request"), p) },
        "resetBuiltInProfile" to { c, p -> module.resetBuiltInProfile(c.string("id"), p) },
        "openCapabilitySettings" to { c, p -> module.openCapabilitySettings(c.string("kind"), p) },
        "takePendingMediaOpen" to { _, p -> module.takePendingMediaOpen(p) },
        "getStatistics" to { c, p -> module.getStatistics(c.number("rangeDays"), p) },
    )

    init {
        // A handler table that drifts from the contract is a build defect;
        // debug builds stop at engine attach rather than fail one call later.
        if (BuildConfig.DEBUG) check(handlers.keys == HostMethods.NAMES) { "nudgio/host handlers drift from HostMethods" }
    }
}

private fun MethodCall.string(key: String): String =
    argument<String>(key) ?: throw IllegalArgumentException("$key is required")

private fun MethodCall.stringOrNull(key: String): String? = argument<String>(key)

private fun MethodCall.boolean(key: String): Boolean =
    argument<Boolean>(key) ?: throw IllegalArgumentException("$key is required")

private fun MethodCall.number(key: String): Double =
    argument<Number>(key)?.toDouble() ?: throw IllegalArgumentException("$key is required")

private fun MethodCall.map(key: String): ReadableMap = WireMap.fromPlatform(argument<Any?>(key))

private fun MethodCall.array(key: String): ReadableArray =
    com.aslam.mediareminder.bridge.wire.WireArray.fromPlatform(argument<Any?>(key))

/**
 * Adapts a channel `Result` to the module's [Promise]. Flutter requires the
 * reply on the platform thread and exactly once; the module answers from IO
 * coroutines and activity callbacks, so both are enforced here.
 */
private class ChannelPromise(private val result: MethodChannel.Result) : Promise {
    @Volatile
    private var settled = false

    override fun resolve(value: Any?) = settle { result.success(toPlatform(value)) }

    override fun reject(code: String, message: String?, userInfo: WireMap?) =
        settle { result.error(code, message, toPlatform(userInfo)) }

    private fun settle(reply: () -> Unit) {
        synchronized(this) {
            if (settled) return
            settled = true
        }
        if (Looper.myLooper() == Looper.getMainLooper()) reply() else mainHandler.post(reply)
    }

    private companion object {
        val mainHandler = Handler(Looper.getMainLooper())
    }
}
