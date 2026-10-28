package com.aslam.mediareminder.bridge

import android.content.Context
import com.aslam.mediareminder.bridge.wire.Arguments
import java.time.Instant

/**
 * MR-06 "Adaptive presentation decision" rule 4: "If the app is foreground,
 * additionally emit an event to show the in-app strip." The JS side already
 * has the receiving half (`ReminderDueEvent` in `lib/native/types.dart`) —
 * this is the native emission counterpart,
 * used only by [com.aslam.mediareminder.alarm.AlarmDispatchReceiver] when
 * [com.aslam.mediareminder.alarm.DevicePresentationState.Decision.allowInAppForegroundEvent]
 * is true.
 *
 * A no-op whenever no Flutter engine is listening ([HostEvents.sink] null —
 * process alive with no engine up yet) or the app is not in front
 * ([HostEvents.hasForegroundActivity] false — engine alive but
 * backgrounded). Neither case
 * loses the reminder: the notification [com.aslam.mediareminder.notifications.NotificationCoordinator]
 * already posted is, per MR-06, "the fallback" regardless of whether this
 * event ever gets delivered.
 */
object ReminderEventEmitter {
    private const val EVENT_REMINDER_DUE_WHILE_FOREGROUND = "reminderDueWhileForeground"

    fun emitReminderDueWhileForeground(
        context: Context,
        sessionId: String,
        nonce: String,
        occurrenceId: String,
        reminderId: String,
        occurrenceKind: String,
        scheduledAtEpochMs: Long,
        occurrenceState: String,
        reminderLabel: String,
        mediaTitle: String,
        defaultSnoozeMinutes: Int,
    ) {
        if (HostEvents.sink == null || !HostEvents.hasForegroundActivity) return

        val occurrence = Arguments.createMap().apply {
            putString("id", occurrenceId)
            putString("reminderId", reminderId)
            putString("kind", occurrenceKind)
            putString("scheduledAt", Instant.ofEpochMilli(scheduledAtEpochMs).toString())
            putString("state", occurrenceState)
        }
        val payload = Arguments.createMap().apply {
            // `sessionId`/`nonce`: so the in-app card can call the same
            // `playDueSession`/`snoozeDueSession`/`dismissDueSession`
            // bridge methods the notification's own buttons resolve
            // through — this event is otherwise just a display hint.
            putString("sessionId", sessionId)
            putString("nonce", nonce)
            putMap("occurrence", occurrence)
            putString("reminderLabel", reminderLabel)
            putString("mediaTitle", mediaTitle)
            putInt("defaultSnoozeMinutes", defaultSnoozeMinutes)
        }
        HostEvents.emit(EVENT_REMINDER_DUE_WHILE_FOREGROUND, payload)
    }
}
