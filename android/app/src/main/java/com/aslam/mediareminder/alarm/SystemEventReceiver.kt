package com.aslam.mediareminder.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.diagnostics.NativeLogger
import com.aslam.mediareminder.notifications.NotificationCoordinator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * MR-06 "Reboot and direct boot" / "Time and timezone changes". Exported
 * `false`; must be declared `android:directBootAware="true"` in the manifest
 * (task #21) — [Intent.ACTION_LOCKED_BOOT_COMPLETED] and this receiver's own
 * [AlarmIds.ACTION_DIRECT_BOOT_ALARM_DUE] both fire before first unlock, when
 * only direct-boot-aware components run at all.
 *
 * Five triggers, three shapes of handling:
 *
 *  - [Intent.ACTION_LOCKED_BOOT_COMPLETED]: pre-unlock. Room is unreadable
 *    (credential-protected storage). Reads [DirectBootEnvelopeStore]
 *    (device-protected, label-free) and arms a bounded pre-unlock alarm if
 *    it holds a future due instant, or posts the generic notification
 *    immediately if that instant already passed while the device was off.
 *  - [AlarmIds.ACTION_DIRECT_BOOT_ALARM_DUE]: the pre-unlock alarm itself
 *    firing. Posts the same generic, label-free notification — still no
 *    Room access, by construction.
 *  - [Intent.ACTION_BOOT_COMPLETED] / [Intent.ACTION_MY_PACKAGE_REPLACED]:
 *    post-unlock (or a fresh install replacing the running one). Room is
 *    readable now. Clears the pre-unlock envelope/notification and runs a
 *    normal [SchedulerCoordinator.reconcile] — "Room reconciliation replaces
 *    the envelope" (MR-06).
 *  - [Intent.ACTION_TIME_CHANGED] / [Intent.ACTION_TIMEZONE_CHANGED]: Room is
 *    readable (the app is already running to receive these). Invalidates
 *    derived (non-`once`) pending occurrences and recomputes them against
 *    the new clock/zone via [SchedulerCoordinator.reconcileAfterClockChange].
 */
class SystemEventReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_LOCKED_BOOT_COMPLETED -> handleLockedBootCompleted(context)
            AlarmIds.ACTION_DIRECT_BOOT_ALARM_DUE -> handleDirectBootAlarmDue(context)
            Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED ->
                handleFullBootReconcile(context, reasonFor(intent.action))
            Intent.ACTION_TIME_CHANGED -> handleClockChange(context, "time_set")
            Intent.ACTION_TIMEZONE_CHANGED -> handleClockChange(context, "timezone_changed")
            else -> return
        }
    }

    private fun reasonFor(action: String?): String =
        if (action == Intent.ACTION_MY_PACKAGE_REPLACED) "package_replaced" else "boot_completed"

    /**
     * No Room access here by design — this is the entire reason
     * [DirectBootEnvelopeStore] exists. Synchronous: `SharedPreferences` and
     * `AlarmManager` calls are fast, non-blocking platform calls, so this
     * intentionally skips `goAsync()`/a coroutine (unlike the Room-touching
     * branches below).
     */
    private fun handleLockedBootCompleted(context: Context) {
        val envelope = DirectBootEnvelopeStore.read(context)
        if (envelope == null) {
            NativeLogger.debug("systemEvent.lockedBoot.noEnvelope")
            return
        }
        val now = System.currentTimeMillis()
        if (envelope.dueAtEpochMs <= now) {
            // Was due while the device was off/rebooting — MR-06 doesn't
            // ask for a compensating "missed" record here (Room can't be
            // touched anyway); BOOT_COMPLETED's reconciliation pass is what
            // resolves the real occurrence once Room is available again.
            NotificationCoordinator(context).postGenericDueNotification()
            NativeLogger.debug("systemEvent.lockedBoot.alreadyDue")
            return
        }
        armDirectBootAlarm(context, envelope.dueAtEpochMs)
        NativeLogger.debug("systemEvent.lockedBoot.armed", mapOf("dueAt" to envelope.dueAtEpochMs))
    }

    private fun armDirectBootAlarm(context: Context, dueAtEpochMs: Long) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, SystemEventReceiver::class.java).apply {
            action = AlarmIds.ACTION_DIRECT_BOOT_ALARM_DUE
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            AlarmIds.DIRECT_BOOT_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        if (ExactAlarmAccess.isAvailable(context)) {
            alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(dueAtEpochMs, null), pendingIntent)
        } else {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, dueAtEpochMs, pendingIntent)
        }
    }

    private fun handleDirectBootAlarmDue(context: Context) {
        NotificationCoordinator(context).postGenericDueNotification()
        NativeLogger.debug("systemEvent.directBootAlarm.notified")
    }

    private fun handleFullBootReconcile(context: Context, reason: String) {
        val pendingResult = goAsync()
        val appContext = context.applicationContext
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                // "Room reconciliation replaces the envelope" (MR-06) — the
                // pre-unlock alarm/notification, if any, are stale the
                // moment the real scheduler can run again.
                val alarmManager = appContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                val cancelIntent = Intent(appContext, SystemEventReceiver::class.java).apply {
                    action = AlarmIds.ACTION_DIRECT_BOOT_ALARM_DUE
                }
                alarmManager.cancel(
                    PendingIntent.getBroadcast(
                        appContext,
                        AlarmIds.DIRECT_BOOT_REQUEST_CODE,
                        cancelIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                    ),
                )
                NotificationCoordinator(appContext).cancelGenericDueNotification()
                DirectBootEnvelopeStore.clear(appContext)

                SchedulerCoordinator(appContext, MediaReminderDatabase.getInstance(appContext)).reconcile(reason)
                NativeLogger.debug("systemEvent.fullBoot.reconciled", mapOf("reason" to reason))
            } catch (error: Throwable) {
                NativeLogger.error("systemEvent.fullBoot.failedSafe", mapOf("reason" to reason), cause = error)
            } finally {
                pendingResult.finish()
            }
        }
    }

    private fun handleClockChange(context: Context, reason: String) {
        val pendingResult = goAsync()
        val appContext = context.applicationContext
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                SchedulerCoordinator(appContext, MediaReminderDatabase.getInstance(appContext))
                    .reconcileAfterClockChange(reason)
                NativeLogger.debug("systemEvent.clockChange.reconciled", mapOf("reason" to reason))
            } catch (error: Throwable) {
                NativeLogger.error("systemEvent.clockChange.failedSafe", mapOf("reason" to reason), cause = error)
                runCatching {
                    SchedulerCoordinator(appContext, MediaReminderDatabase.getInstance(appContext))
                        .reconcile("clock_change_failed_safe")
                }
            } finally {
                pendingResult.finish()
            }
        }
    }
}
