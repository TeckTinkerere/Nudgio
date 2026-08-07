package com.aslam.mediareminder.alarm

import android.app.AlarmManager
import android.content.Context
import android.os.Build

/**
 * ADR-006: "Request `SCHEDULE_EXACT_ALARM` contextually... prefer
 * `setAlarmClock()`... when denied, offer explicit inexact Limited mode."
 *
 * Below API 31 exact alarms need no special access at all — `canScheduleExactAlarms()`
 * does not exist before S, and the manifest permission alone is sufficient.
 * This object is the single place that question is answered, shared by
 * [SchedulerCoordinator] (to decide `setAlarmClock()` vs
 * `setAndAllowWhileIdle()`) and
 * [com.aslam.mediareminder.capability.CapabilitySnapshotProvider] (to report
 * the `exact_alarm` capability row), so the two can never disagree.
 */
object ExactAlarmAccess {
    fun isAvailable(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true
        }
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            ?: return false
        return alarmManager.canScheduleExactAlarms()
    }
}
