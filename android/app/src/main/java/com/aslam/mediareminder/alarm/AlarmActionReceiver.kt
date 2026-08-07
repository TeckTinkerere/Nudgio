package com.aslam.mediareminder.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.diagnostics.NativeLogger
import com.aslam.mediareminder.notifications.NotificationCoordinator

/**
 * Handles the three notification actions [NotificationCoordinator] wires up
 * (Play/Snooze/Dismiss). Exported `false` — only reachable via the
 * `PendingIntent`s that class itself constructs.
 *
 * All resolution logic (nonce check, idempotency, occurrence/session state
 * transition, snooze-occurrence insertion) lives in [AlarmActionProcessor],
 * shared with `MediaReminderModule`'s in-app equivalents — this receiver is
 * just that processor's notification-tap entry point, plus the
 * notification-cancel and reconcile steps only *this* path is responsible
 * for (the in-app path's caller does the RN-visible equivalent instead).
 *
 * AND-002 ("Play/Snooze/Dismiss work with the React Native bridge
 * intentionally disabled") is what this receiver exists to satisfy — nothing
 * here touches Metro, the JS bundle, or `MediaReminderModule`.
 */
class AlarmActionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action !in setOf(AlarmIds.ACTION_PLAY, AlarmIds.ACTION_SNOOZE, AlarmIds.ACTION_DISMISS)) return

        val sessionId = intent.getStringExtra(AlarmIds.EXTRA_SESSION_ID)
        val nonce = intent.getStringExtra(AlarmIds.EXTRA_NONCE)
        if (sessionId == null || nonce == null) {
            NativeLogger.warn("alarm.action.missingExtras", mapOf("action" to action))
            return
        }

        val appContext = context.applicationContext
        dispatchWithWakeLock(
            context = context,
            wakeLockTag = "MediaReminder:AlarmAction",
            wakeLockTimeoutMs = WAKE_LOCK_TIMEOUT_MS,
            onFailure = { error ->
                // MR-07 "Error architecture": a crash here must still leave a
                // consistent scheduler state, even if this particular action
                // could not be resolved.
                NativeLogger.error("alarm.action.failedSafe", mapOf("action" to action), cause = error)
                runCatching {
                    SchedulerCoordinator(appContext, MediaReminderDatabase.getInstance(appContext))
                        .reconcile("alarm_action_failed_safe")
                }
            },
        ) {
            handle(appContext, action, sessionId, nonce)
        }
    }

    private suspend fun handle(context: Context, action: String, sessionId: String, nonce: String) {
        val database = MediaReminderDatabase.getInstance(context)

        when (val outcome = AlarmActionProcessor.process(database, action, sessionId, nonce)) {
            is AlarmActionProcessor.Outcome.UnknownSession -> {
                NativeLogger.warn("alarm.action.unknownSession", mapOf("sessionId" to sessionId))
            }

            AlarmActionProcessor.Outcome.AlreadyResolved -> {
                NativeLogger.debug("alarm.action.alreadyResolved", mapOf("action" to action, "sessionId" to sessionId))
            }

            is AlarmActionProcessor.Outcome.Resolved -> {
                NotificationCoordinator(context).cancel(sessionId)
                AlarmRingingService.stopSession(context, sessionId)
                NativeLogger.debug(
                    "alarm.action.resolved",
                    mapOf("action" to outcome.actionLabel, "sessionId" to sessionId, "occurrenceId" to outcome.occurrenceId),
                )
                // Whatever just happened (accepted/snoozed/dismissed), the
                // occurrence that was `alerting` is no longer pending —
                // reconcile so a repeating reminder's next cycle (or the
                // fresh snooze occurrence) gets registered as the new single
                // global alarm (ADR-005).
                SchedulerCoordinator(context, database).reconcile("alarm_action_${outcome.actionLabel}")
            }
        }
    }

    private companion object {
        const val WAKE_LOCK_TIMEOUT_MS = 10_000L
    }
}
