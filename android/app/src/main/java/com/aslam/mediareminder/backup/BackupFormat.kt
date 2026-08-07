package com.aslam.mediareminder.backup

/**
 * MR-10 constants: archive layout, versioning and validation limits. One
 * place these numbers live, since both the exporter and the importer must
 * agree on them exactly.
 */
object BackupFormat {
    const val FORMAT_ID = "com.aslam.mediareminder.backup"

    /** MR-10 "Version 1 archives are plain ZIP files" — major.minor. */
    const val ARCHIVE_VERSION = "1.0"
    const val ARCHIVE_MAJOR_VERSION = 1

    /** A reader at this exact archive version is always sufficient for what this writer produces. */
    const val MINIMUM_READER_ARCHIVE_VERSION = "1.0"

    const val HASH_ALGORITHM = "SHA-256"
    const val RECORDS_ENCODING = "UTF-8 JSON"
    const val PRIVACY_LABEL = "contains-private-media"
    const val SCOPE_ALL = "all"

    // --- Archive entry names (MR-10 "Archive layout") ---------------------------
    const val ENTRY_MANIFEST = "manifest.json"
    const val ENTRY_README = "README.txt"
    const val ENTRY_CHECKSUMS = "checksums.sha256"
    const val ENTRY_MEDIA_ASSETS = "data/media-assets.json"
    const val ENTRY_REMINDER_PROFILES = "data/reminder-profiles.json"
    const val ENTRY_CATEGORIES = "data/categories.json"
    const val ENTRY_TAGS = "data/tags.json"
    const val ENTRY_REMINDERS = "data/reminders.json"
    const val ENTRY_SCHEDULE_RULES = "data/schedule-rules.json"
    const val ENTRY_REMINDER_TAGS = "data/reminder-tags.json"
    const val ENTRY_SETTINGS = "data/settings.json"
    const val MEDIA_DIR_PREFIX = "media/"

    /** Every entry an importer requires to exist (media/ files are referenced by count, not required to be nonempty). */
    val REQUIRED_DATA_ENTRIES = listOf(
        ENTRY_MEDIA_ASSETS,
        ENTRY_REMINDER_PROFILES,
        ENTRY_CATEGORIES,
        ENTRY_TAGS,
        ENTRY_REMINDERS,
        ENTRY_SCHEDULE_RULES,
        ENTRY_REMINDER_TAGS,
        ENTRY_SETTINGS,
    )

    // --- Validation limits (MR-10 "Validation limits") ---------------------------
    const val MAX_ZIP_ENTRIES = 20_000
    const val MAX_UNCOMPRESSED_TOTAL_BYTES = 10L * 1024 * 1024 * 1024 // 10 GB
    const val MAX_MEDIA_ENTRY_BYTES = 2L * 1024 * 1024 * 1024 // 2 GB
    const val MAX_AGGREGATE_JSON_BYTES = 100L * 1024 * 1024 // 100 MB
    const val COMPRESSION_RATIO_WARNING = 100
    const val COMPRESSION_RATIO_REJECT = 300
}
