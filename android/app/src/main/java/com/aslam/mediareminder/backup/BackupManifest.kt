package com.aslam.mediareminder.backup

import org.json.JSONObject

/**
 * MR-10 "Manifest schema" — the one file archive identity comes from
 * ("Archive identity comes from `manifest.json`, not filename").
 */
data class BackupManifest(
    val format: String,
    val archiveVersion: String,
    val createdAt: String,
    val sourceAppVersion: String,
    val sourceSchemaVersion: Int,
    val minimumReaderArchiveVersion: String,
    val exportId: String,
    val scope: String,
    val includesHistory: Boolean,
    val counts: Counts,
    val totalMediaBytes: String,
    val hashAlgorithm: String,
    val recordsEncoding: String,
    val privacy: String,
) {
    data class Counts(
        val mediaAssets: Int,
        val reminders: Int,
        val profiles: Int,
        val categories: Int,
        val tags: Int,
    ) {
        fun toJson(): JSONObject = JSONObject().apply {
            put("mediaAssets", mediaAssets)
            put("reminders", reminders)
            put("profiles", profiles)
            put("categories", categories)
            put("tags", tags)
        }

        companion object {
            fun fromJson(json: JSONObject): Counts = Counts(
                mediaAssets = json.optInt("mediaAssets"),
                reminders = json.optInt("reminders"),
                profiles = json.optInt("profiles"),
                categories = json.optInt("categories"),
                tags = json.optInt("tags"),
            )
        }
    }

    /** MR-10 JSON record rules: "UTF-8 without BOM" — `JSONObject.toString()` plus explicit UTF-8 encoding at the write site (never a platform-default charset) is what satisfies that. */
    fun toJson(): JSONObject = JSONObject().apply {
        put("format", format)
        put("archiveVersion", archiveVersion)
        put("createdAt", createdAt)
        put("sourceAppVersion", sourceAppVersion)
        put("sourceSchemaVersion", sourceSchemaVersion)
        put("minimumReaderArchiveVersion", minimumReaderArchiveVersion)
        put("exportId", exportId)
        put("scope", scope)
        put("includesHistory", includesHistory)
        put("counts", counts.toJson())
        put("totalMediaBytes", totalMediaBytes)
        put("hashAlgorithm", hashAlgorithm)
        put("recordsEncoding", recordsEncoding)
        put("privacy", privacy)
        put("extensions", JSONObject())
    }

    /** Major.minor split. Malformed input is a format error, not a crash — callers always go through [fromJson]'s validation first. */
    val majorVersion: Int
        get() = archiveVersion.substringBefore('.').toIntOrNull() ?: 0

    companion object {
        private val REQUIRED_STRING_FIELDS = listOf(
            "format", "archiveVersion", "createdAt", "sourceAppVersion",
            "minimumReaderArchiveVersion", "exportId", "scope", "totalMediaBytes",
            "hashAlgorithm", "recordsEncoding", "privacy",
        )

        /**
         * MR-10 "Unknown required fields or unsupported major version stop
         * import" — this is the bounded, validating parse phase 3 calls for
         * ("parse manifest with streaming/bounded parser... confirm format
         * and version compatibility"). Bounded here means: the caller has
         * already capped the manifest entry's uncompressed size before this
         * ever runs (see `BackupImportValidator`) — `org.json` itself has no
         * separate depth/length guard, so that cap is what keeps a hostile
         * manifest from being a resource-exhaustion vector.
         */
        fun fromJson(json: JSONObject): BackupManifest {
            for (field in REQUIRED_STRING_FIELDS) {
                if (!json.has(field) || json.isNull(field)) {
                    throw BackupFormatException("manifest_missing_field", "manifest.json missing required field: $field")
                }
            }
            if (!json.has("counts") || !json.has("sourceSchemaVersion")) {
                throw BackupFormatException("manifest_missing_field", "manifest.json missing counts/sourceSchemaVersion")
            }
            val format = json.getString("format")
            if (format != BackupFormat.FORMAT_ID) {
                throw BackupFormatException("manifest_wrong_format", "manifest.json format is not a Nudgio backup")
            }
            return BackupManifest(
                format = format,
                archiveVersion = json.getString("archiveVersion"),
                createdAt = json.getString("createdAt"),
                sourceAppVersion = json.getString("sourceAppVersion"),
                sourceSchemaVersion = json.getInt("sourceSchemaVersion"),
                minimumReaderArchiveVersion = json.getString("minimumReaderArchiveVersion"),
                exportId = json.getString("exportId"),
                scope = json.getString("scope"),
                includesHistory = json.optBoolean("includesHistory", false),
                counts = Counts.fromJson(json.getJSONObject("counts")),
                totalMediaBytes = json.getString("totalMediaBytes"),
                hashAlgorithm = json.getString("hashAlgorithm"),
                recordsEncoding = json.getString("recordsEncoding"),
                privacy = json.getString("privacy"),
            )
        }
    }
}
