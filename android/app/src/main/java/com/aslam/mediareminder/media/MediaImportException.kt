package com.aslam.mediareminder.media

/**
 * A recognized media-import failure. [reasonCode] is a stable internal string
 * the bridge layer maps to an MR-08 wire error code — the same split
 * [com.aslam.mediareminder.backup.BackupFormatException] uses, so the reason
 * a human debugs from Logcat is more specific than the coarser wire code the
 * user's screen sees.
 */
class MediaImportException(val reasonCode: String, message: String) : Exception(message) {
    companion object {
        const val UNSUPPORTED_TYPE = "media_import_unsupported_type"
        const val SOURCE_UNREADABLE = "media_import_source_unreadable"
        const val STORAGE_INSUFFICIENT = "media_import_storage_insufficient"
        const val TOO_LARGE = "media_import_too_large"
        const val WRITE_FAILED = "media_import_write_failed"
    }
}

/** Mirrors [com.aslam.mediareminder.backup.BackupCancelledException] — a cooperative cancel, not a fault. */
class MediaImportCancelledException : Exception("Media import cancelled")
