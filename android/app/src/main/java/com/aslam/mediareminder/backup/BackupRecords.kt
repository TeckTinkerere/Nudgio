package com.aslam.mediareminder.backup

import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.aslam.mediareminder.data.db.entity.ReminderEntity
import com.aslam.mediareminder.data.db.entity.ReminderProfileEntity
import com.aslam.mediareminder.reminders.ReminderActionRules
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

/**
 * Room entity <-> MR-10 portable JSON record. Field names mirror the
 * `data/`-directory JSON example shapes in MR-10 (not written as `data/*.json`
 * here — Kotlin block comments nest, so a literal `/` immediately followed by
 * `*` inside this doc comment opens an unintended nested comment and silently
 * breaks parsing of everything after it until the next stray `*/` happens to
 * rebalance it), not raw Room column names — the
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
        // Additive and optional (DL-080): omitted entirely for "no action",
        // so an archive without any actions is byte-identical in shape to a
        // pre-actions one, and older readers simply never see the key.
        if (entity.actionType != null && entity.actionUri != null) {
            put(
                "action",
                JSONObject().apply {
                    put("type", entity.actionType)
                    put("uri", entity.actionUri)
                    put("label", entity.actionLabel ?: JSONObject.NULL)
                },
            )
        }
    }

    fun fromJson(json: JSONObject): ReminderEntity =
        decodeBackupRecord("reminder_record_malformed", "Malformed reminders.json record") {
            // An archive is untrusted input: the action goes through the same
            // rules as a save, and an unsafe one fails the whole record
            // rather than being silently dropped or silently kept.
            val actionJson = json.optJSONObject("action")
            val action = when (
                val resolved = ReminderActionRules.validate(
                    type = actionJson?.optString("type")?.takeIf { it.isNotEmpty() },
                    uri = actionJson?.optString("uri"),
                    label = actionJson?.takeUnless { it.isNull("label") }?.optString("label"),
                )
            ) {
                is ReminderActionRules.Result.Ok -> resolved.action
                is ReminderActionRules.Result.Invalid ->
                    throw BackupFormatException("reminder_record_malformed", "Invalid reminder action")
            }
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
                actionType = action?.type,
                actionUri = action?.uri,
                actionLabel = action?.label,
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
 * `media-assets.json` records.
 *
 * `storageKey` is in the record because it is the *archive* filename too:
 * each asset's bytes ride along at `media/<storageKey>`, so the record and
 * the file find each other without a second index. It stays opaque
 * (`<uuid>.<ext>`, never user text), which is what makes it safe to use as a
 * zip entry name — a title-derived name would reintroduce exactly the path
 * traversal `MediaStorage` exists to prevent.
 *
 * Omitted deliberately:
 *  - `entityVersion`, per this file's header: optimistic-concurrency state is
 *    local, and a restored row starts its version history fresh.
 *  - `thumbnailPath`, which names a file in `cacheDir` that the OS may
 *    reclaim at any time. Shipping derived cache in a backup would bloat the
 *    archive to re-create something `backfillMissingThumbnails` rebuilds for
 *    free on first read.
 *  - `categoryId`, since no `categories` table exists; it restores as null,
 *    the same value every exported row carries today.
 *
 * `integrityState` is **not** trusted from the archive. A restore writes
 * `unchecked` and lets the startup integrity sweep decide against the
 * filesystem it actually landed on — an asset marked `healthy` on the
 * exporting phone proves nothing about whether its bytes survived the trip.
 */
object BackupMediaAssetCodec {
    fun toJson(entity: MediaAssetEntity): JSONObject = JSONObject().apply {
        put("id", entity.id)
        put("kind", entity.kind)
        put("title", entity.title)
        put("notes", entity.notes ?: JSONObject.NULL)
        put("storageKey", entity.storageKey)
        put("mimeType", entity.mimeType)
        put("sizeBytes", entity.sizeBytes.toString())
        put("sha256", entity.sha256)
        put("durationMs", entity.durationMs ?: JSONObject.NULL)
        put("widthPx", entity.widthPx ?: JSONObject.NULL)
        put("heightPx", entity.heightPx ?: JSONObject.NULL)
        put("createdAt", Instant.ofEpochMilli(entity.createdAt).toString())
        put("updatedAt", Instant.ofEpochMilli(entity.updatedAt).toString())
    }

    fun fromJson(json: JSONObject): MediaAssetEntity =
        decodeBackupRecord("media_record_malformed", "Malformed media-assets.json record") {
            val kind = json.getString("kind")
            if (kind !in MediaAssetEntity.KINDS) {
                throw BackupFormatException("media_record_malformed", "Unknown media kind: $kind")
            }
            val storageKey = json.getString("storageKey")
            // The storage key becomes a filename on this device, so it is
            // checked here rather than trusted: an archive is attacker-
            // controlled input, and `media/../../databases/x` inside a record
            // would otherwise be written wherever it pointed.
            if (storageKey.isBlank() || storageKey.contains('/') || storageKey.contains('\\') || storageKey.startsWith(".")) {
                throw BackupFormatException("media_record_malformed", "Unsafe media storage key")
            }
            MediaAssetEntity(
                id = json.getString("id"),
                kind = kind,
                title = json.getString("title"),
                notes = if (json.isNull("notes")) null else json.optString("notes"),
                storageKey = storageKey,
                mimeType = json.getString("mimeType"),
                sizeBytes = json.getString("sizeBytes").toLong(),
                sha256 = json.getString("sha256"),
                durationMs = if (json.isNull("durationMs")) null else json.getLong("durationMs"),
                widthPx = if (json.isNull("widthPx")) null else json.getInt("widthPx"),
                heightPx = if (json.isNull("heightPx")) null else json.getInt("heightPx"),
                categoryId = null,
                integrityState = MediaAssetEntity.INTEGRITY_UNCHECKED,
                createdAt = Instant.parse(json.getString("createdAt")).toEpochMilli(),
                updatedAt = Instant.parse(json.getString("updatedAt")).toEpochMilli(),
                thumbnailPath = null,
            )
        }
}

/**
 * `categories.json`/`tags.json`/`reminder-tags.json`: always an empty array
 * today. No `categories`/`tags` Room tables exist (the same gap
 * docs/decision-log.md DL-012 already recorded for the reminder engine).
 * These entries are still written on every export, and still read
 * (tolerating absence of any of their optional fields) on every import, so
 * the archive layout is complete and forward-compatible the moment a future
 * slice starts populating them — no format version bump required for that,
 * since MR-10's own JSON-record rules already tolerate additive fields
 * inside `extensions`.
 *
 * `media-assets.json` used to be in this list and no longer is: it carries
 * real records (see [BackupMediaAssetCodec]) as of the managed-media work.
 */
object BackupEmptyArrayCodec {
    fun emptyArray(): JSONArray = JSONArray()
}
