package com.aslam.mediareminder

import android.content.Intent
import android.os.Bundle
import com.aslam.mediareminder.media.IncomingShare
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * React Native host activity.
 *
 * MR-07: "MainActivity - React Native host." It owns only Metro/Fabric
 * wiring. The startup reconciler, splash/theme shell and navigation are all
 * JS-side (`src/app`); this class deliberately has nothing else in it so the
 * dependency-direction test in MR-07 ("Android entry components depend on
 * use cases/coordinators, not on UI") has nothing to violate here.
 */
class MainActivity : ReactActivity() {

    override fun getMainComponentName(): String = "MediaReminder"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    /**
     * react-native-screens requires this: its `ScreenStackFragment`s cannot be
     * restored through Android's default fragment-restoration mechanism (the
     * JS-side navigator, not the Activity, is the source of truth for screen
     * state). Passing the real `savedInstanceState` through crashes with
     * `IllegalStateException: Screen fragments should never be restored` the
     * moment the OS recreates this Activity with a non-null saved state —
     * e.g. the process was frozen/killed while an alarm was ringing and the
     * user then tries to reopen the app from the launcher or a notification.
     * Passing `null` here is the documented fix (react-native-screens#Android
     * setup): it skips Android's own state restore since JS re-derives the
     * correct screen from scratch on cold start anyway.
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)
        // "Share to Nudgio" (DL-110). Only on a fresh launch: a recreated
        // Activity carries the same intent again, and the share was already
        // taken the first time.
        if (savedInstanceState == null) captureShare(intent)
    }

    /** `singleTask`: a share while the app is already open arrives here. */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        captureShare(intent)
    }

    private fun captureShare(intent: Intent?) {
        IncomingShare.capture(intent, ownAuthority = "$packageName.fileprovider")
    }
}
