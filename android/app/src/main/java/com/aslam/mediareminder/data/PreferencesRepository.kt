package com.aslam.mediareminder.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import kotlinx.coroutines.flow.first

/**
 * Preferences storage (MR-07: "Theme and lightweight preferences" -> DataStore,
 * owned by the settings repository, read by React Native through queries).
 *
 * This is the one piece of real persistence in this foundation slice — Room
 * is deliberately not introduced yet (that is reminder/media/backup logic),
 * but appearance settings are exactly the "state management... storage
 * abstraction" this change was scoped to build, and the JS side
 * (`core/storage/NativePreferencesStore.ts`) already expects a working
 * `getPreferences`/`setPreferences` pair.
 *
 * The Preferences DataStore extension property is declared at file scope, as
 * the Android docs require, so there is exactly one DataStore instance for
 * the process regardless of how many call sites resolve it.
 */
private val Context.preferencesDataStore by preferencesDataStore(name = "media_reminder_preferences")

class PreferencesRepository(private val context: Context) {

    private object Keys {
        val THEME_PREFERENCE = stringPreferencesKey("theme_preference")
        val USE_MATERIAL_YOU = booleanPreferencesKey("use_material_you")
        val USE_24_HOUR_TIME = booleanPreferencesKey("use_24_hour_time")
        val LANGUAGE_TAG = stringPreferencesKey("language_tag")
        val HAS_COMPLETED_ONBOARDING = booleanPreferencesKey("has_completed_onboarding")
        val DEFAULT_SNOOZE_MINUTES = intPreferencesKey("default_snooze_minutes")
    }

    /** Matches `defaultPreferences` in `src/core/storage/PreferencesStore.ts`. */
    private object Defaults {
        const val THEME_PREFERENCE = "system"
        const val USE_MATERIAL_YOU = false
        const val HAS_COMPLETED_ONBOARDING = false
        const val DEFAULT_SNOOZE_MINUTES = 10
    }

    /** Plain-Kotlin counterpart to [read] — used by callers (the backup engine) that must not depend on the RN bridge's `WritableMap`. */
    data class Snapshot(
        val themePreference: String,
        val useMaterialYou: Boolean,
        val use24HourTime: Boolean?,
        val languageTag: String?,
        val hasCompletedOnboarding: Boolean,
        val defaultSnoozeMinutes: Int,
    )

    suspend fun readSnapshot(): Snapshot {
        val snapshot = context.preferencesDataStore.data.first()
        return Snapshot(
            themePreference = snapshot[Keys.THEME_PREFERENCE] ?: Defaults.THEME_PREFERENCE,
            useMaterialYou = snapshot[Keys.USE_MATERIAL_YOU] ?: Defaults.USE_MATERIAL_YOU,
            use24HourTime = snapshot[Keys.USE_24_HOUR_TIME],
            languageTag = snapshot[Keys.LANGUAGE_TAG],
            hasCompletedOnboarding = snapshot[Keys.HAS_COMPLETED_ONBOARDING] ?: Defaults.HAS_COMPLETED_ONBOARDING,
            defaultSnoozeMinutes = snapshot[Keys.DEFAULT_SNOOZE_MINUTES] ?: Defaults.DEFAULT_SNOOZE_MINUTES,
        )
    }

    suspend fun read(): WritableMap {
        val snapshot = readSnapshot()
        return Arguments.createMap().apply {
            putString("themePreference", snapshot.themePreference)
            putBoolean("useMaterialYou", snapshot.useMaterialYou)
            // `null` means "follow the device" (MR-13's 12/24-hour rule) and
            // is a real, distinct third state from true/false.
            val use24Hour = snapshot.use24HourTime
            if (use24Hour == null) putNull("use24HourTime") else putBoolean("use24HourTime", use24Hour)

            val languageTag = snapshot.languageTag
            if (languageTag == null) putNull("languageTag") else putString("languageTag", languageTag)

            putBoolean("hasCompletedOnboarding", snapshot.hasCompletedOnboarding)
            putInt("defaultSnoozeMinutes", snapshot.defaultSnoozeMinutes)
        }
    }

    /**
     * Applies only the keys present in [patch]. Mirrors the `PreferencePatch`
     * partial-update contract in `native-client/types.ts` — two settings
     * screens writing different keys must not clobber each other.
     */
    suspend fun write(patch: ReadableMap): WritableMap {
        context.preferencesDataStore.edit { prefs ->
            if (patch.hasKey("themePreference")) {
                prefs[Keys.THEME_PREFERENCE] = patch.getString("themePreference") ?: Defaults.THEME_PREFERENCE
            }
            if (patch.hasKey("useMaterialYou")) {
                prefs[Keys.USE_MATERIAL_YOU] = patch.getBoolean("useMaterialYou")
            }
            if (patch.hasKey("use24HourTime")) {
                if (patch.isNull("use24HourTime")) {
                    prefs.remove(Keys.USE_24_HOUR_TIME)
                } else {
                    prefs[Keys.USE_24_HOUR_TIME] = patch.getBoolean("use24HourTime")
                }
            }
            if (patch.hasKey("languageTag")) {
                if (patch.isNull("languageTag")) {
                    prefs.remove(Keys.LANGUAGE_TAG)
                } else {
                    patch.getString("languageTag")?.let { prefs[Keys.LANGUAGE_TAG] = it }
                }
            }
            if (patch.hasKey("hasCompletedOnboarding")) {
                prefs[Keys.HAS_COMPLETED_ONBOARDING] = patch.getBoolean("hasCompletedOnboarding")
            }
            if (patch.hasKey("defaultSnoozeMinutes")) {
                prefs[Keys.DEFAULT_SNOOZE_MINUTES] = patch.getInt("defaultSnoozeMinutes")
            }
        }
        return read()
    }

    /**
     * Full-replace counterpart to [write], for the backup importer restoring
     * `data/settings.json` — every field is always set (a complete record,
     * not a partial patch). MR-10's "Replace: device-owned settings remain
     * unchanged" refers to OS-level state (notification permission,
     * exact-alarm grant — never written to the archive at all, per MR-10's
     * "Excluded" list), not this app-owned preference set, which the archive
     * does carry and both Merge and Replace restore.
     */
    suspend fun applySnapshot(snapshot: Snapshot) {
        context.preferencesDataStore.edit { prefs ->
            prefs[Keys.THEME_PREFERENCE] = snapshot.themePreference
            prefs[Keys.USE_MATERIAL_YOU] = snapshot.useMaterialYou
            if (snapshot.use24HourTime == null) prefs.remove(Keys.USE_24_HOUR_TIME) else prefs[Keys.USE_24_HOUR_TIME] = snapshot.use24HourTime
            if (snapshot.languageTag == null) prefs.remove(Keys.LANGUAGE_TAG) else prefs[Keys.LANGUAGE_TAG] = snapshot.languageTag
            prefs[Keys.HAS_COMPLETED_ONBOARDING] = snapshot.hasCompletedOnboarding
            prefs[Keys.DEFAULT_SNOOZE_MINUTES] = snapshot.defaultSnoozeMinutes
        }
    }
}
