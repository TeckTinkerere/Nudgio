package com.aslam.mediareminder.bridge

import android.content.Context
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicLong

/**
 * MR-08 "Operations and progress": the single `operationProgress` event path.
 *
 * Every long-running operation reports through here — backup export/inspection
 * (via [BackupOperationEmitter], which adapts its own progress type onto this)
 * and media import. Extracted rather than copied for the media slice because
 * the `sequence` counter has to be monotonic **per operation id**: two emitters
 * with their own counter maps would each start at 1 and the JS side's
 * event-gap detection (MR-08: `sequence` exists to detect dropped events) would
 * see the sequence jump backwards.
 *
 * A no-op whenever React Native is not running, the same
 * [ReminderEventEmitter] rule: the journal-backed operation is always the
 * source of truth, never this event stream alone. An import that finishes while
 * JS is dead still committed its row.
 */
object OperationProgressEmitter {
    private const val EVENT_OPERATION_PROGRESS = "operationProgress"
    private val sequenceCounters = ConcurrentHashMap<String, AtomicLong>()

    /** MR-03 progress phases shared by every operation kind. */
    const val PHASE_COPYING = "copying"
    const val PHASE_CHECKING = "checking"
    const val PHASE_CREATING_PREVIEW = "creating_preview"
    const val PHASE_READY = "ready"

    @Suppress("LongParameterList")
    fun emit(
        context: Context,
        operationId: String,
        kind: String,
        phase: String,
        cancellable: Boolean,
        completedBytes: Long? = null,
        totalBytes: Long? = null,
        currentItemIndex: Int? = null,
        totalItems: Int? = null,
    ) {
        val app = context.applicationContext as? ReactApplication ?: return
        // `ReactApplication.reactHost` is itself nullable in RN 0.86.
        val reactContext = app.reactHost?.currentReactContext ?: return

        val sequence = sequenceCounters.getOrPut(operationId) { AtomicLong(0) }.incrementAndGet()
        val payload = Arguments.createMap().apply {
            putString("operationId", operationId)
            putString("kind", kind)
            putString("phase", phase)
            // Byte counts are decimal strings, not numbers: MR-08 allows a
            // media file to exceed Number.MAX_SAFE_INTEGER in bytes.
            completedBytes?.let { putString("completedUnits", it.toString()) }
            totalBytes?.let { putString("totalUnits", it.toString()) }
            currentItemIndex?.let { putInt("currentItemIndex", it) }
            totalItems?.let { putInt("totalItems", it) }
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
