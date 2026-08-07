package com.aslam.mediareminder.notifications

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.aslam.mediareminder.R
import com.aslam.mediareminder.alarm.AlarmActionReceiver
import com.aslam.mediareminder.alarm.AlarmActivity
import com.aslam.mediareminder.alarm.AlarmIds

/**
 * MR-06 "Notification construction" / "Notification channels".
 *
 * Posts the actionable due-alarm notification — title, due time/media name,
 * Play/Snooze/Dismiss — for every presentation path
 * [com.aslam.mediareminder.alarm.DevicePresentationState] can produce. The
 * notification itself is the same shape whether or not a full-screen intent
 * is attached; [AlarmActivity] (the locked/non-interactive takeover surface)
 * and continuous ringing are additive on top of it, not a replacement for it
 * — the notification is always there so Play/Snooze/Dismiss remain reachable
 * even if the activity is dismissed or never shown.
 *
 * "Channels are versioned because Android channel importance and sound
 * become user-controlled after creation." [CHANNEL_ALARM]/[CHANNEL_REMINDER]
 * carry a `_v1` suffix for exactly that reason — a future default change
 * ships as `_v2` and a migration prompt, never a mutation of the existing
 * channel object.
 */
class NotificationCoordinator(private val context: Context) {

    private val manager = NotificationManagerCompat.from(context)

    fun ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val systemManager = context.getSystemService(NotificationManager::class.java) ?: return

        // CATEGORY_ALARM channel (Standard/Persistent — MR-06).
        systemManager.createNotificationChannel(
            NotificationChannel(CHANNEL_ALARM, "Reminders (alarm)", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Standard and Persistent reminders"
                enableVibration(true)
                setBypassDnd(false)
            },
        )
        // CATEGORY_REMINDER channel (Gentle — MR-06).
        systemManager.createNotificationChannel(
            NotificationChannel(CHANNEL_REMINDER, "Reminders (gentle)", NotificationManager.IMPORTANCE_DEFAULT).apply {
                description = "Gentle reminders"
            },
        )
    }

    /**
     * Builds (without posting) the due-alarm notification. Split from
     * [postDueNotification] so [com.aslam.mediareminder.alarm.AlarmRingingService]
     * can pass the identical [Notification] object to `startForeground()` —
     * the foreground-service notification and the shade notification must be
     * the same content, not two builders that could silently drift apart.
     *
     * `notificationId` is derived from a stable hash of the session id
     * (MR-06: "Notification IDs are derived from stable session hashes with
     * collision tests" — the collision-test half belongs in an
     * instrumentation test once a real device is available, see
     * docs/decision-log.md).
     *
     * @param useFullScreenIntent MR-06 rule 1: attach a full-screen intent
     *   to [AlarmActivity] — see [com.aslam.mediareminder.alarm.DevicePresentationState].
     *   Never combined with `ongoing = false`; a full-screen-eligible
     *   session is by construction one [AlarmRingingService] is about to
     *   ring for.
     */
    fun buildDueNotification(
        sessionId: String,
        reminderLabel: String,
        mediaTitle: String,
        nonce: String,
        useAlarmChannel: Boolean,
        ongoing: Boolean,
        useFullScreenIntent: Boolean,
    ): Notification {
        // Bug fix: this is the real due-alarm path (AlarmDispatchReceiver,
        // AlarmRingingService), but unlike postGenericDueNotification/
        // postTestNotification it never called ensureChannels() itself. On a
        // fresh install where the user has never run Test reminder and the
        // device has never gone through a locked-boot direct-boot cycle,
        // CHANNEL_ALARM/CHANNEL_REMINDER would not exist yet — and
        // NotificationManager silently drops a notification posted against a
        // nonexistent channel on API 26+ (no exception, nothing shown). Idempotent:
        // createNotificationChannel() is a no-op once the channel exists.
        ensureChannels()
        val channelId = if (useAlarmChannel) CHANNEL_ALARM else CHANNEL_REMINDER
        val category = if (useAlarmChannel) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_REMINDER

        val builder = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle(reminderLabel)
            .setContentText(mediaTitle)
            .setCategory(category)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOngoing(ongoing)
            .setAutoCancel(!ongoing)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            // MR-06 "A content intent opens the due item... without
            // resolving it" — tapping the body brings the alarm UI forward,
            // it is not itself a Play/Snooze/Dismiss action.
            .setContentIntent(alarmActivityIntent(sessionId))
            .addAction(actionFor("Play", AlarmIds.ACTION_PLAY, sessionId, nonce, notificationIdFor(sessionId)))
            .addAction(actionFor("Snooze", AlarmIds.ACTION_SNOOZE, sessionId, nonce, notificationIdFor(sessionId)))
            .addAction(actionFor("Dismiss", AlarmIds.ACTION_DISMISS, sessionId, nonce, notificationIdFor(sessionId)))

        if (useFullScreenIntent) {
            builder.setFullScreenIntent(alarmActivityIntent(sessionId), true)
        }
        return builder.build()
    }

    fun postDueNotification(
        sessionId: String,
        occurrenceId: String,
        reminderLabel: String,
        mediaTitle: String,
        nonce: String,
        useAlarmChannel: Boolean,
        ongoing: Boolean,
        useFullScreenIntent: Boolean = false,
    ) {
        manager.notify(
            notificationIdFor(sessionId),
            buildDueNotification(sessionId, reminderLabel, mediaTitle, nonce, useAlarmChannel, ongoing, useFullScreenIntent),
        )
    }

    private fun alarmActivityIntent(sessionId: String): PendingIntent {
        val intent = Intent(context, AlarmActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(AlarmIds.EXTRA_SESSION_ID, sessionId)
        }
        return PendingIntent.getActivity(
            context,
            notificationIdFor(sessionId),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    fun cancel(sessionId: String) {
        manager.cancel(notificationIdFor(sessionId))
    }

    /**
     * ADR-017 / MR-06 "Reboot and direct boot": "the app can reschedule a
     * generic due alert" before first unlock. Deliberately hardcoded,
     * generic English copy with no reminder label or media title — Room
     * (and therefore any real content or localization lookup keyed off it)
     * is unreadable at this point, and MR-06 explicitly forbids putting
     * sensitive content in the direct-boot envelope this notification is
     * triggered from. Once `BOOT_COMPLETED` fires and Room reconciliation
     * runs, the normal, real notification path takes over and this one is
     * cancelled ([cancelGenericDueNotification]).
     */
    fun postGenericDueNotification() {
        ensureChannels()
        val notification = NotificationCompat.Builder(context, CHANNEL_ALARM)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Reminder due")
            .setContentText("Unlock your device to see details.")
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        manager.notify(GENERIC_DIRECT_BOOT_NOTIFICATION_ID, notification)
    }

    fun cancelGenericDueNotification() {
        manager.cancel(GENERIC_DIRECT_BOOT_NOTIFICATION_ID)
    }

    /**
     * MR-03 "Test reminder": lets the user verify notifications actually
     * appear (and, indirectly, exercise the adaptive-presentation/capability
     * path) without a real reminder. Scope note (docs/decision-log.md): this
     * is a simple auto-cancel notification with no Play/Snooze/Dismiss
     * actions — those actions resolve against a real
     * [com.aslam.mediareminder.data.db.entity.ActiveAlarmSessionEntity] row,
     * which itself requires a real, FK-referenced `occurrences` row, and a
     * test reminder deliberately never writes real occurrence history
     * (MR-09/MR-03: it is explicitly outside "skip completed"/retention
     * semantics). Building fake session/occurrence rows just to hang three
     * buttons off a test notification was judged not worth the schema
     * contortion for what MR-03 frames as a capability smoke test.
     */
    fun postTestNotification() {
        ensureChannels()
        val notification = NotificationCompat.Builder(context, CHANNEL_REMINDER)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Test reminder")
            .setContentText("This is what your reminders look like.")
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()
        manager.notify(TEST_NOTIFICATION_ID, notification)
    }

    private fun actionFor(
        label: String,
        action: String,
        sessionId: String,
        nonce: String,
        requestCode: Int,
    ): NotificationCompat.Action {
        val intent = Intent(context, AlarmActionReceiver::class.java).apply {
            this.action = action
            putExtra(AlarmIds.EXTRA_SESSION_ID, sessionId)
            putExtra(AlarmIds.EXTRA_NONCE, nonce)
        }
        // Request code must be distinct per (session, action) pair or the
        // three actions' PendingIntents collide and Android silently reuses
        // one Intent's extras for all three buttons.
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            requestCode + action.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Action.Builder(0, label, pendingIntent).build()
    }

    /**
     * Stable, bounded 31-bit notification ID derived from the session id
     * (MR-06: "Notification IDs are derived from stable session hashes").
     * Public: [AlarmDispatchReceiver] needs the same ID to persist it on
     * [com.aslam.mediareminder.data.db.entity.ActiveAlarmSessionEntity]
     * before this class is ever asked to post anything.
     */
    fun notificationIdFor(sessionId: String): Int = sessionId.hashCode() and 0x7fffffff

    companion object {
        const val CHANNEL_ALARM = "reminders_alarm_v1"
        const val CHANNEL_REMINDER = "reminders_gentle_v1"

        /** A single, well-known ID — at most one generic direct-boot notification exists at a time. */
        private const val GENERIC_DIRECT_BOOT_NOTIFICATION_ID = 0x4452_424F // "DRBO"

        /** A single, well-known ID — MR-03's Test reminder is bounded and non-repeating, never more than one outstanding. */
        private const val TEST_NOTIFICATION_ID = 0x54455354 // "TEST"
    }
}
