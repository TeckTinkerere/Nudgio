package com.aslam.mediareminder.bridge

import android.content.Context
import com.aslam.mediareminder.backup.BackupProgress
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * MR-08 "Operations and progress": emits `OperationProgressEvent` for the
 * backup engine's export/import operations, the same
 * `RCTDeviceEventEmitter`-based pattern
 * [com.aslam.mediareminder.bridge.ReminderEventEmitter] already established
 * for `reminderDueWhileForeground` — a no-op whenever RN is not actually
 * running, since the notification/journal-backed operation itself is always
 * the source of truth, never this event stream alone.
 */
object BackupOperationEmitter {
    private const val EVENT_OPERATION_PROGRESS = "operationProgress"
    private val sequenceCounters = ConcurrentHashMap<String, AtomicLong>()

    fun emit(context: Context, operationId: String, kind: String, progress: BackupProgress, cancellable: Boolean) {
        val app = context.applicationContext as? ReactApplication ?: return
        // `ReactApplication.reactHost` is itself nullable in RN 0.86 (never
        // compiled against the real AAR before now — docs/decision-log.md).
        val reactContext = app.reactHost?.currentReactContext ?: return

        val sequence = sequenceCounters.getOrPut(operationId) { AtomicLong(0) }.incrementAndGet()
        val payload = Arguments.createMap().apply {
            putString("operationId", operationId)
            putString("kind", kind)
            putString("phase", progress.phase)
            progress.completedBytes?.let { putString("completedUnits", it.toString()) }
            progress.totalBytes?.let { putString("totalUnits", it.toString()) }
            progress.currentItemIndex?.let { putInt("currentItemIndex", it) }
            progress.totalItems?.let { putInt("totalItems", it) }
            putBoolean("cancellable", cancellable)
            putString("sequence", sequence.toString())
            putString("correlationId", UUID.randomUUID().toString())
        }
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_OPERATION_PROGRESS, payload)
    }

    fun clear(operationId: String) {
        sequenceCounters.remove(operationId)
    }
}
