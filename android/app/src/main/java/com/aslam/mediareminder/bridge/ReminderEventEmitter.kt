package com.aslam.mediareminder.bridge

import android.content.Context
import com.facebook.react.ReactApplication
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.time.Instant

/**
 * MR-06 "Adaptive presentation decision" rule 4: "If the app is foreground,
 * additionally emit an event to show the in-app strip." The JS side already
 * has the receiving half wired (`src/core/state/sessionStore.ts`'s
 * `InAppDueBanner`/`showDueBanner`) — this is the native emission counterpart,
 * used only by [com.aslam.mediareminder.alarm.AlarmDispatchReceiver] when
 * [com.aslam.mediareminder.alarm.DevicePresentationState.Decision.allowInAppForegroundEvent]
 * is true.
 *
 * A no-op whenever RN is not actually running (`ReactHost.currentReactContext`
 * null — process alive with no JS engine up yet, or the New Architecture
 * host between reloads) or has no attached foreground activity
 * (`hasCurrentActivity()` false — RN alive but backgrounded). Neither case
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
        val app = context.applicationContext as? ReactApplication ?: return
        val reactContext = app.reactHost.currentReactContext ?: return
        if (!reactContext.hasCurrentActivity()) return

        val occurrence = Arguments.createMap().apply {
            putString("id", occurrenceId)
            putString("reminderId", reminderId)
            putString("kind", occurrenceKind)
            putString("scheduledAt", Instant.ofEpochMilli(scheduledAtEpochMs).toString())
            putString("state", occurrenceState)
        }
        val payload = Arguments.createMap().apply {
            // `sessionId`/`nonce`: so the JS card can call the same
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
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(EVENT_REMINDER_DUE_WHILE_FOREGROUND, payload)
    }
}
