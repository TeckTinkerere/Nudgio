package com.aslam.mediareminder.bridge

import android.app.Activity

/**
 * What [MediaReminderModule] needs from the UI host: the foreground activity
 * (pickers, share sheets) and runtime-permission prompts. [NudgioPlugin]
 * implements it from Flutter's `ActivityPluginBinding`; under React Native it
 * was `ReactApplicationContext.currentActivity` and `PermissionAwareActivity`.
 */
interface ActivityHost {
    val currentActivity: Activity?

    /** Shows the system dialog; [onResult] receives the grant results, once. */
    fun requestPermissions(permissions: Array<String>, requestCode: Int, onResult: (IntArray) -> Unit)
}
