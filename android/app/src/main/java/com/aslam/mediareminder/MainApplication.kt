package com.aslam.mediareminder

import android.app.Application

/**
 * Application entry point.
 *
 * Deliberately empty since the Flutter host swap (ADR-023): the engine is
 * created by [MainActivity] when the UI opens, never here, so a broadcast
 * receiver or the ringing service that starts the process for an alarm does
 * not pay for (or depend on) a Dart VM. Startup reconciliation runs in the
 * receivers and in the host module, as before.
 */
class MainApplication : Application()
