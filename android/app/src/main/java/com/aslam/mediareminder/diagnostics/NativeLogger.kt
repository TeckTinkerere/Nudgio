package com.aslam.mediareminder.diagnostics

import android.util.Log
import com.aslam.mediareminder.bridge.BuildVariant

/**
 * The Kotlin-side counterpart to `core/logging/Logger.ts`.
 *
 * MR-07 "Observability": diagnostics use "bounded files and privacy-safe
 * event fields" and specifically exclude "content titles or file paths."
 * This foundation slice logs to Logcat only, gated on build variant exactly
 * like the JS `Logger` is; the bounded ring-buffer file sink described in
 * MR-07 is `diagnostics/`'s first real implementation task once there is
 * alarm/import/backup activity worth recording durably.
 *
 * Call sites pass structured `fields`, never a formatted sentence, so a
 * future file sink can serialize the same event shape the JS side already
 * uses without a rewrite at every call site.
 */
object NativeLogger {

    private const val TAG = "MediaReminder"

    /** Mirrors `featureFlagsFor(variant).verboseLogging` on the JS side. */
    private val verbose: Boolean
        get() = BuildVariant.current == "debug"

    fun debug(event: String, fields: Map<String, Any?> = emptyMap()) {
        if (verbose) Log.d(TAG, format(event, fields))
    }

    fun info(event: String, fields: Map<String, Any?> = emptyMap()) {
        if (verbose) Log.i(TAG, format(event, fields))
    }

    /** Warnings and errors log in every variant — they are what QA/support triage from. */
    fun warn(event: String, fields: Map<String, Any?> = emptyMap()) {
        Log.w(TAG, format(event, fields))
    }

    fun error(event: String, fields: Map<String, Any?> = emptyMap(), cause: Throwable? = null) {
        Log.e(TAG, format(event, fields), cause)
    }

    private fun format(event: String, fields: Map<String, Any?>): String =
        if (fields.isEmpty()) event else "$event ${fields.entries.joinToString(" ") { (k, v) -> "$k=$v" }}"
}
