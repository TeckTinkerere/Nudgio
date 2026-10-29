package com.aslam.mediareminder

import android.content.Intent
import android.os.Bundle
import com.aslam.mediareminder.bridge.HostEvents
import com.aslam.mediareminder.bridge.NudgioPlugin
import com.aslam.mediareminder.media.IncomingShare
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

/**
 * Flutter host activity (ADR-023).
 *
 * MR-07: "MainActivity - UI host." It owns only engine wiring: [NudgioPlugin]
 * connects the engine to the Kotlin core, and everything the user sees is
 * Dart (`lib/`). Alarms never depend on this activity or its engine:
 * `AlarmActivity`, the receivers and `AlarmRingingService` run without it, so
 * the dependency-direction rule in MR-07 ("Android entry components depend on
 * use cases/coordinators, not on UI") has nothing to violate here.
 */
class MainActivity : FlutterActivity() {

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        // Registers pub plugins (GeneratedPluginRegistrant) before ours.
        super.configureFlutterEngine(flutterEngine)
        flutterEngine.plugins.add(NudgioPlugin())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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

    // MR-06 rule 4: the in-app due card is only for someone looking at the app.
    override fun onResume() {
        super.onResume()
        HostEvents.hasForegroundActivity = true
    }

    override fun onPause() {
        HostEvents.hasForegroundActivity = false
        super.onPause()
    }

    private fun captureShare(intent: Intent?) {
        IncomingShare.capture(intent, ownAuthority = "$packageName.fileprovider")
    }
}
