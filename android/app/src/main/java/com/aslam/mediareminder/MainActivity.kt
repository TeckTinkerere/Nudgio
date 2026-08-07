package com.aslam.mediareminder

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
}
