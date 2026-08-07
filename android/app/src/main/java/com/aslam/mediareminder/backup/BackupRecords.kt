package com.aslam.mediareminder.backup

import com.aslam.mediareminder.data.db.entity.ReminderEntity
import com.aslam.mediareminder.data.db.entity.ReminderProfileEntity
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

/**
 * Room entity <-> MR-10 portable JSON record. Field names mirror the
 * `data/*.json` example shapes in MR-10, not raw Room column names — the
 * whole point of a logical export format ("independent of internal Room
 * layout") is that it does not need to change just because a Room migration
 * renames or restructures a column.
 *
 * `entityVersion` (optimistic-concurrency, local-only) is deliberately never
 * part of the portable record — MR-10's own example records don't carry it,
 * and a restored-on-a-different-device row starts its version history fresh
 * regardless.
 */
/**
 * Shared malformed-record wrapping for every `fromJson` codec in this
 * package (also used by [BackupScheduleRuleCodec]): a [BackupFormatException]
 * already thrown inside [block] (e.g. a required-field check that ran before
 * the rest of the parse) passes through unchanged; any other exception — a
 * missing/wrong-typed JSON field, a bad `Instant`/`LocalTime` parse — becomes
 * one, with a codec-specific [code]/[message]. Previously each `fromJson`
 * duplicated this exact try/catch shape (docs/decision-log.md).
 */
internal inline fun <T> decodeBackupRecord(code: String, message: String, block: () -> T): T =
    try {
        block()
    } catch (error: BackupFormatException) {
        throw error
    } catch (error: Exception) {
        throw BackupFormatException(code, message)
    }

object BackupReminderProfileCodec {
    fun toJson(entity: ReminderProfileEntity): JSONObject = JSONObject().apply {
        put("id", entity.id)
        put("nameKey", entity.nameKey)
        put("isBuiltIn", entity.isBuiltIn)
        put("fullScreenWhenLocked", entity.fullScreenWhenLocked)
        put("timeoutSeconds", entity.timeoutSeconds)
        put("retryCount", entity.retryCount)
        put("graceSeconds", entity.graceSeconds)
        put("defaultSnoozeMinutes", entity.defaultSnoozeMinutes)
        put("createdAt", Instant.ofEpochMilli(entity.createdAt).toString())
        put("updatedAt", Instant.ofEpochMilli(entity.updatedAt).toString())
    }

    fun fromJson(json: JSONObject): ReminderProfileEntity =
        decodeBackupRecord("profile_record_malformed", "Malformed reminder-profiles.json record") {
            ReminderProfileEntity(
                id = json.getString("id"),
                nameKey = json.getString("nameKey"),
                isBuiltIn = json.getBoolean("isBuiltIn"),
                fullScreenWhenLocked = json.getBoolean("fullScreenWhenLocked"),
                timeoutSeconds = json.getInt("timeoutSeconds").coerceIn(15, 600),
                retryCount = json.getInt("retryCount").coerceIn(0, 3),
                graceSeconds = json.getInt("graceSeconds"),
                defaultSnoozeMinutes = json.getInt("defaultSnoozeMinutes"),
                createdAt = Instant.parse(json.getString("createdAt")).toEpochMilli(),
                updatedAt = Instant.parse(json.getString("updatedAt")).toEpochMilli(),
            )
        }
}

object BackupReminderCodec {
    fun toJson(entity: ReminderEntity): JSONObject = JSONObject().apply {
        put("id", entity.id)
        put("mediaId", entity.mediaId)
        put("label", entity.label)
        put("notes", entity.notes)
        put("profileId", entity.profileId)
        put("enabledIntent", entity.enabledIntent)
        put("effectiveState", entity.effectiveState)
        put("snoozeDefaultMinutes", entity.snoozeDefaultMinutes)
        put("snoozeAllowCustom", entity.snoozeAllowCustom)
        put("snoozeMinimumMinutes", entity.snoozeMinimumMinutes)
        put("snoozeMaximumMinutes", entity.snoozeMaximumMinutes)
        put("historyEnabled", entity.historyEnabled)
        put("createdAt", Instant.ofEpochMilli(entity.createdAt).toString())
        put("updatedAt", Instant.ofEpochMilli(entity.updatedAt).toString())
    }

    fun fromJson(json: JSONObject): ReminderEntity =
        decodeBackupRecord("reminder_record_malformed", "Malformed reminders.json record") {
            ReminderEntity(
                id = json.getString("id"),
                mediaId = json.getString("mediaId"),
                label = json.getString("label"),
                notes = if (json.isNull("notes")) null else json.optString("notes"),
                profileId = json.getString("profileId"),
                enabledIntent = json.getBoolean("enabledIntent"),
                effectiveState = json.optString("effectiveState", ReminderEntity.STATE_NEEDS_SETUP),
                snoozeDefaultMinutes = json.getInt("snoozeDefaultMinutes"),
                snoozeAllowCustom = json.getBoolean("snoozeAllowCustom"),
                snoozeMinimumMinutes = json.getInt("snoozeMinimumMinutes"),
                snoozeMaximumMinutes = json.getInt("snoozeMaximumMinutes"),
                historyEnabled = json.getBoolean("historyEnabled"),
                createdAt = Instant.parse(json.getString("createdAt")).toEpochMilli(),
                updatedAt = Instant.parse(json.getString("updatedAt")).toEpochMilli(),
            )
        }
}

/** Mirrors `PreferencesSnapshot` (`native-client/types.ts`) exactly — that DTO is already the portable shape. */
object BackupSettingsCodec {
    fun toJson(
        themePreference: String,
        useMaterialYou: Boolean,
        use24HourTime: Boolean?,
        languageTag: String?,
        hasCompletedOnboarding: Boolean,
        defaultSnoozeMinutes: Int,
    ): JSONObject = JSONObject().apply {
        put("themePreference", themePreference)
        put("useMaterialYou", useMaterialYou)
        put("use24HourTime", use24HourTime)
        put("languageTag", languageTag)
        put("hasCompletedOnboarding", hasCompletedOnboarding)
        put("defaultSnoozeMinutes", defaultSnoozeMinutes)
    }
}

/**
 * `media-assets.json`/`categories.json`/`tags.json`/`reminder-tags.json`:
 * always an empty array today. No media import pipeline exists yet (no
 * `media_assets`/`categories`/`tags` Room tables — the same gap
 * docs/decision-log.md DL-012 already recorded for the reminder engine).
 * These entries are still written on every export, and still read
 * (tolerating absence of any of their optional fields) on every import, so
 * the archive layout is complete and forward-compatible the moment a future
 * media-import slice starts populating them — no format version bump
 * required for that, since MR-10's own JSON-record rules already tolerate
 * additive fields inside `extensions`.
 */
object BackupEmptyArrayCodec {
    fun emptyArray(): JSONArray = JSONArray()
}
