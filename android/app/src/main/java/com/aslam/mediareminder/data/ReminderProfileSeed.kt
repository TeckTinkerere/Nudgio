package com.aslam.mediareminder.data

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap

/**
 * The three built-in reminder profiles (ADR-018: "Seed Gentle, Standard and
 * Persistent default profiles").
 *
 * These UUIDs are stable identifiers, not generated data — MR-09: "Stable
 * built-in UUIDs are seeded in migration." They intentionally match the ones
 * used by the JS-side mock (`native-client/mockNativeModule.ts`) so a
 * screen's behavior is identical whether it is talking to this stub or the
 * Metro-only mock. Once Room exists, these constants become the actual
 * migration seed values rather than an in-memory list.
 */
object ReminderProfileSeed {

    private data class Profile(
        val id: String,
        val nameKey: String,
        val fullScreenWhenLocked: Boolean,
        val timeoutSeconds: Int,
        val retryCount: Int,
        val graceSeconds: Int,
        val defaultSnoozeMinutes: Int,
    )

    private val profiles = listOf(
        Profile(
            id = "00000000-0000-4000-8000-000000000001",
            nameKey = "profile.gentle.name",
            fullScreenWhenLocked = false,
            timeoutSeconds = 60,
            retryCount = 0,
            graceSeconds = 300,
            defaultSnoozeMinutes = 10,
        ),
        Profile(
            id = "00000000-0000-4000-8000-000000000002",
            nameKey = "profile.standard.name",
            fullScreenWhenLocked = true,
            timeoutSeconds = 300,
            retryCount = 1,
            graceSeconds = 600,
            defaultSnoozeMinutes = 10,
        ),
        Profile(
            id = "00000000-0000-4000-8000-000000000003",
            nameKey = "profile.persistent.name",
            fullScreenWhenLocked = true,
            timeoutSeconds = 600,
            retryCount = 3,
            graceSeconds = 900,
            defaultSnoozeMinutes = 5,
        ),
    )

    fun asWritableArray(): WritableArray = Arguments.createArray().apply {
        profiles.forEach { profile ->
            pushMap(
                Arguments.createMap().apply {
                    putString("id", profile.id)
                    putString("nameKey", profile.nameKey)
                    putBoolean("isBuiltIn", true)
                    putBoolean("fullScreenWhenLocked", profile.fullScreenWhenLocked)
                    putInt("timeoutSeconds", profile.timeoutSeconds)
                    putInt("retryCount", profile.retryCount)
                    putInt("graceSeconds", profile.graceSeconds)
                    putInt("defaultSnoozeMinutes", profile.defaultSnoozeMinutes)
                    putInt("entityVersion", 1)
                } as WritableMap,
            )
        }
    }
}
