package com.aslam.mediareminder.backup

/**
 * The storage key an archive's media record carries becomes
 * `File(mediaDir, storageKey)` on restore. [MediaStorage.newStorageKey]
 * only ever writes `<uuid>.<ext>`, so that is the only shape accepted
 * (SEC-10); path safety no longer depends on a later ZIP entry-name check
 * happening to reject the same value.
 */
object BackupStorageKey {
    private val FORMAT = Regex("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.[a-z0-9]{1,8}$")

    fun isValid(storageKey: String): Boolean = FORMAT.matches(storageKey)

    fun require(storageKey: String) {
        if (!isValid(storageKey)) {
            throw BackupFormatException("media_storage_key_invalid", "A media record has an unexpected storage key")
        }
    }
}

/**
 * Running total of the JSON and manifest bytes read for one archive.
 *
 * [BackupFormat.MAX_AGGREGATE_JSON_BYTES] is named an aggregate but was
 * enforced per entry, so eight entries could be held in memory at up to
 * 100 MB each (SEC-06). Every entry now draws from one shared budget, and
 * [BackupFormat.MAX_JSON_ENTRY_BYTES] caps any single one.
 */
class BackupJsonBudget(private val totalLimit: Long = BackupFormat.MAX_AGGREGATE_JSON_BYTES) {
    var used: Long = 0
        private set

    /** Records [bytes] more read from [entryName]; throws once the shared budget is spent. */
    fun charge(entryName: String, bytes: Long) {
        used += bytes
        if (used > totalLimit) {
            throw BackupFormatException(
                "zip_json_total_exceeded",
                "The archive's data files exceed the combined size limit (at $entryName)",
            )
        }
    }
}
