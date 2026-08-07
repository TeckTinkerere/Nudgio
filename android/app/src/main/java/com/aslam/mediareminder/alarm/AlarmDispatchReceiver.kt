package com.aslam.mediareminder.alarm

import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationManagerCompat
import com.aslam.mediareminder.bridge.ReminderEventEmitter
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.ActiveAlarmSessionEntity
import com.aslam.mediareminder.data.db.entity.OccurrenceEntity
import com.aslam.mediareminder.diagnostics.NativeLogger
import com.aslam.mediareminder.notifications.NotificationCoordinator
import java.time.Instant
import java.util.UUID

/**
 * MR-06 "Alarm dispatch": a small manifest receiver, implemented in Kotlin,
 * with no dependency on Metro, the RN bundle or any JS state (MR-07 "Alarm
 * isolation"). Exported `false` (see `AndroidManifest.xml`) — it only ever
 * receives the `PendingIntent` `SchedulerCoordinator` itself registered.
 *
 * Implements all nine steps of MR-06's dispatch algorithm: steps 1-4 (reject
 * stale/already-resolved, atomically claim), 6 ([DevicePresentationState]),
 * 5 (post the notification, start [AlarmRingingService] when the profile
 * wants continuous ringing, emit the in-app event when appropriate), and 8-9
 * (reconcile the next occurrence, release the wake bridge). AND-002
 * ("Play/Snooze/Dismiss work with the React Native bridge intentionally
 * disabled") holds regardless of presentation path: those actions are wired
 * end-to-end through [AlarmActionReceiver], independent of RN.
 */
class AlarmDispatchReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            AlarmIds.ACTION_ALARM_DUE -> handleDueAlarm(context, intent)
            // MR-03 "Test reminder": self-contained, no Room/session
            // involvement at all (see `NotificationCoordinator.postTestNotification`'s
            // scope note) — cheap enough to run synchronously, no
            // goAsync()/wake lock needed.
            AlarmIds.ACTION_TEST_ALARM_DUE -> NotificationCoordinator(context).postTestNotification()
            else -> return
        }
    }

    private fun handleDueAlarm(context: Context, intent: Intent) {
        val generation = intent.getLongExtra(AlarmIds.EXTRA_GENERATION, -1L)
        val occurrenceId = intent.getStringExtra(AlarmIds.EXTRA_OCCURRENCE_ID)
        val reminderId = intent.getStringExtra(AlarmIds.EXTRA_REMINDER_ID)
        val appContext = context.applicationContext

        // MR-06: "receiver bridge wake lock: maximum 10 seconds and released
        // in finally." `AlarmManager`'s own delivery guarantee already keeps
        // the CPU awake for the duration of `goAsync()`'s pending result on
        // stock AOSP; this explicit, bounded lock is the documented defense
        // against OEM power-management deviations from that guarantee.
        dispatchWithWakeLock(
            context = context,
            wakeLockTag = "MediaReminder:AlarmDispatch",
            wakeLockTimeoutMs = WAKE_LOCK_TIMEOUT_MS,
            onFailure = { error ->
                // MR-07 "Error architecture": components fail safe. A crash
                // here must not leave the app with no next alarm registered.
                NativeLogger.error("alarm.dispatchFailedSafe", cause = error)
                runCatching {
                    SchedulerCoordinator(appContext, MediaReminderDatabase.getInstance(appContext))
                        .reconcile("dispatch_failed_safe")
                }
            },
        ) {
            dispatch(appContext, generation, occurrenceId, reminderId)
        }
    }

    private suspend fun dispatch(context: Context, generation: Long, occurrenceId: String?, reminderId: String?) {
        val database = MediaReminderDatabase.getInstance(context)
        val schedulerState = database.schedulerStateDao().get()

        // Step 2/3: reject a stale broadcast. A `PendingIntent` fired before
        // a newer `reconcile()` call superseded it carries the old
        // generation; the receiver must not act on it (MR-06 AND-003's
        // "stale PendingIntent cannot resolve a newer occurrence").
        if (schedulerState == null || generation != schedulerState.desiredGeneration) {
            NativeLogger.warn(
                "alarm.staleGeneration",
                mapOf("receivedGeneration" to generation, "currentGeneration" to (schedulerState?.desiredGeneration ?: -1)),
            )
            return
        }
        if (occurrenceId == null || reminderId == null) {
            NativeLogger.warn("alarm.missingExtras")
            return
        }

        val occurrenceDao = database.occurrenceDao()
        val occurrence = occurrenceDao.getById(occurrenceId)
        if (occurrence == null || occurrence.state !in setOf(OccurrenceEntity.STATE_PENDING, OccurrenceEntity.STATE_CLAIMED)) {
            // Already resolved (e.g. dismissed from the notification shade
            // moments earlier) — MR-08 "already resolved" is a success-like,
            // silent no-op here, not an error.
            NativeLogger.debug("alarm.alreadyResolved", mapOf("occurrenceId" to occurrenceId))
            return
        }

        val now = Instant.now().toEpochMilli()
        // Step 4: atomic claim. The `WHERE state IN (...)` guard in the DAO
        // query means a second, concurrent dispatch for the same occurrence
        // (should never happen with the mutex in `SchedulerCoordinator`, but
        // MR-06 asks for this to be a real idempotency claim, not merely an
        // in-memory mutex) claims zero rows and backs off.
        val claimed = occurrenceDao.claim(occurrenceId, OccurrenceEntity.STATE_CLAIMED, now)
        if (claimed == 0) {
            NativeLogger.debug("alarm.claimLost", mapOf("occurrenceId" to occurrenceId))
            return
        }

        val reminder = database.reminderDao().getById(reminderId)
        if (reminder == null) {
            occurrenceDao.resolve(occurrenceId, OccurrenceEntity.STATE_FAILED_SAFE, action = "reminder_missing", resolvedAt = now)
        } else {
            val sessionId = UUID.randomUUID().toString()
            val nonce = UUID.randomUUID().toString()
            val profile = database.reminderProfileDao().getById(reminder.profileId)
            // Ringing gate — independent of lock state (see
            // `DevicePresentationState`'s class doc): Standard/Persistent
            // ring and use `CATEGORY_ALARM`, Gentle never does.
            val useAlarmChannel = profile?.fullScreenWhenLocked ?: true
            val notificationCoordinator = NotificationCoordinator(context)

            val decision = DevicePresentationState.classify(
                isLockedOrNonInteractive = isLockedOrNonInteractive(context),
                profilePermitsLockedAlarm = useAlarmChannel,
                notificationsUsable = NotificationManagerCompat.from(context).areNotificationsEnabled(),
                fullScreenIntentEligible = fullScreenIntentEligible(context),
            )
            val presentationDecisionLabel = when {
                decision.useFullScreenIntent -> "locked_full_screen"
                decision.fullScreenIntentLimited -> "locked_limited_fsi"
                else -> "unlocked_notification"
            }

            // Persisted *before* posting: `AlarmActionReceiver` must be able
            // to resolve `sessionId` the instant the notification becomes
            // interactive, and a crash between insert and post is safer than
            // one between post and insert (a notification with no matching
            // session would accept taps it cannot validate a nonce against).
            database.activeAlarmSessionDao().upsert(
                ActiveAlarmSessionEntity(
                    id = sessionId,
                    occurrenceId = occurrenceId,
                    reminderId = reminderId,
                    state = ActiveAlarmSessionEntity.STATE_ALERTING,
                    startedAt = now,
                    presentationDecision = presentationDecisionLabel,
                    notificationId = notificationCoordinator.notificationIdFor(sessionId),
                    actionNonce = nonce,
                    lastUpdate = now,
                ),
            )

            notificationCoordinator.postDueNotification(
                sessionId = sessionId,
                occurrenceId = occurrenceId,
                reminderLabel = reminder.label,
                mediaTitle = reminder.label,
                nonce = nonce,
                useAlarmChannel = useAlarmChannel,
                ongoing = useAlarmChannel,
                useFullScreenIntent = decision.useFullScreenIntent,
            )

            // Step 5 (the rest of it): start continuous ringing for a
            // profile that wants it. `AlarmRingingService` itself decides
            // whether to ring immediately or queue behind an already-
            // alerting session (multiple simultaneous reminders).
            if (useAlarmChannel) {
                AlarmRingingService.ring(context, sessionId)
            }
            if (decision.allowInAppForegroundEvent) {
                ReminderEventEmitter.emitReminderDueWhileForeground(
                    context = context,
                    sessionId = sessionId,
                    nonce = nonce,
                    occurrenceId = occurrenceId,
                    reminderId = reminderId,
                    occurrenceKind = occurrence.kind,
                    scheduledAtEpochMs = occurrence.scheduledAt,
                    occurrenceState = OccurrenceEntity.STATE_CLAIMED,
                    reminderLabel = reminder.label,
                    mediaTitle = reminder.label,
                    defaultSnoozeMinutes = reminder.snoozeDefaultMinutes,
                )
            }

            NativeLogger.debug(
                "alarm.notified",
                mapOf(
                    "occurrenceId" to occurrenceId,
                    "reminderId" to reminderId,
                    "sessionId" to sessionId,
                    "presentation" to presentationDecisionLabel,
                    "ringing" to useAlarmChannel,
                ),
            )
        }

        // Step 8: schedule the next occurrence before completing. The
        // resolved/claimed occurrence above is no longer "pending", so
        // `SchedulerCoordinator.ensurePendingOccurrencesExist` computes and
        // inserts this reminder's *next* cycle (or archives it, for `once`)
        // as part of this same reconcile call.
        SchedulerCoordinator(context, database).reconcile("occurrence_dispatched")
    }

    /** `KeyguardManager.isKeyguardLocked()` (device locked) or the screen simply being off (`!isInteractive`) — either means step 6's "locked or non-interactive." */
    private fun isLockedOrNonInteractive(context: Context): Boolean {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
        return !powerManager.isInteractive || keyguardManager.isKeyguardLocked
    }

    /**
     * Below API 34, full-screen intents work once the manifest permission is
     * declared — no runtime gate exists. API 34+ additionally requires
     * `NotificationManager.canUseFullScreenIntent()`.
     */
    private fun fullScreenIntentEligible(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
        val manager = context.getSystemService(NotificationManager::class.java) ?: return false
        return manager.canUseFullScreenIntent()
    }

    private companion object {
        const val WAKE_LOCK_TIMEOUT_MS = 10_000L
    }
}
