package com.aslam.mediareminder.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import java.time.Instant

/**
 * MR-03 "Test reminder": a single bounded alarm on [AlarmIds.TEST_ALARM_REQUEST_CODE] —
 * a distinct identity from [AlarmIds.DUE_ALARM_REQUEST_CODE], so scheduling
 * or firing a test alarm never disturbs the one real reminder alarm ADR-005
 * guarantees is registered. No Room row is created for it (see
 * [com.aslam.mediareminder.notifications.NotificationCoordinator.postTestNotification]'s
 * scope note) — [AlarmDispatchReceiver] handles [AlarmIds.ACTION_TEST_ALARM_DUE]
 * by posting a notification directly, with nothing to reconcile afterward.
 */
object TestAlarmScheduler {
    fun schedule(
        context: Context,
        at: Instant,
        previewTitle: String,
        previewBody: String,
        previewFullScreen: Boolean,
    ) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, AlarmDispatchReceiver::class.java).apply {
            action = AlarmIds.ACTION_TEST_ALARM_DUE
            putExtra(AlarmIds.EXTRA_PREVIEW_TITLE, previewTitle)
            putExtra(AlarmIds.EXTRA_PREVIEW_BODY, previewBody)
            putExtra(AlarmIds.EXTRA_PREVIEW_FULL_SCREEN, previewFullScreen)
        }
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            AlarmIds.TEST_ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        if (ExactAlarmAccess.isAvailable(context)) {
            alarmManager.setAlarmClock(AlarmManager.AlarmClockInfo(at.toEpochMilli(), null), pendingIntent)
        } else {
            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at.toEpochMilli(), pendingIntent)
        }
    }
}
