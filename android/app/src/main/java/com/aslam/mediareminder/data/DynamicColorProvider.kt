package com.aslam.mediareminder.data

import android.content.Context
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap

/**
 * Material You palette extraction (MR-04's dynamic-color opt-in; see
 * `design-system/theme/materialYou.ts`'s module doc for why this reads the
 * platform's own ramps instead of reimplementing HCT tonal generation).
 *
 * Android exposes the wallpaper-derived Material palette as system resource
 * arrays — `android:array/system_accent1`, `system_accent2`, `system_accent3`,
 * `system_neutral1`, `system_neutral2` — each holding 13 tonal stops from 0 to
 * 1000, available from API 31 (Android 12) onward. There is no public,
 * type-safe SDK accessor for these; reading them by resource name via
 * `Resources.getIdentifier` is the same approach used by AndroidX's own
 * `DynamicColors` internals, which is why this file isolates the lookup
 * behind one object rather than scattering resource-name strings through the
 * module.
 */
object DynamicColorProvider {

    private val TONE_STOPS = listOf(0, 10, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000)

    private val RAMP_NAMES = mapOf(
        "accent1" to "system_accent1",
        "accent2" to "system_accent2",
        "accent3" to "system_accent3",
        "neutral1" to "system_neutral1",
        "neutral2" to "system_neutral2",
    )

    val isSupported: Boolean = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S

    /** Returns `null` below API 31, or if the platform declines to report a ramp. */
    fun read(context: Context): WritableMap? {
        if (!isSupported) return null

        val resources = context.resources
        val packageName = "android"
        val result = Arguments.createMap()

        for ((tsKey, resourceName) in RAMP_NAMES) {
            val arrayResId = resources.getIdentifier(resourceName, "array", packageName)
            if (arrayResId == 0) {
                // A missing ramp on this OEM build means the whole palette is
                // unreliable; degrade to "unsupported" rather than report a
                // partial scheme the theme layer would have to guess at.
                return null
            }

            val colors = try {
                resources.getIntArray(arrayResId)
            } catch (_: android.content.res.Resources.NotFoundException) {
                return null
            }

            if (colors.size < TONE_STOPS.size) {
                return null
            }

            val ramp: WritableMap = Arguments.createMap()
            TONE_STOPS.forEachIndexed { index, stop ->
                ramp.putString(stop.toString(), String.format("#%06X", 0xFFFFFF and colors[index]))
            }
            result.putMap(tsKey, ramp)
        }

        return result
    }
}
