package com.aslam.mediareminder.alarm

import android.app.NotificationManager
import android.content.Context
import android.os.Build

/**
 * Below API 34, `USE_FULL_SCREEN_INTENT` works once declared in the
 * manifest — no runtime gate exists. API 34+ additionally requires the user
 * to grant it as special access, observed via
 * `NotificationManager.canUseFullScreenIntent()`. This object is the single
 * place that question is answered, shared by [AlarmDispatchReceiver] (to
 * decide whether to attach `setFullScreenIntent()` at all, matching
 * MR-06's "CATEGORY_ALARM for Standard/Urgent" fallback rule) and
 * [com.aslam.mediareminder.capability.CapabilitySnapshotProvider] (to report
 * the `full_screen_intent` capability row), so the two can never disagree.
 */
object FullScreenIntentAccess {
    fun isAvailable(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true
        val manager = context.getSystemService(NotificationManager::class.java) ?: return false
        return manager.canUseFullScreenIntent()
    }
}
