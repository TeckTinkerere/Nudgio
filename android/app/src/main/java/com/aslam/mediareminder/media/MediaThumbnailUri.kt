package com.aslam.mediareminder.media

import android.net.Uri
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity

/**
 * Shared by [MediaDtoWriter] and
 * [com.aslam.mediareminder.reminders.ReminderDtoWriter] so "does the cached
 * thumbnail file still exist" (MR-09: the cache "may be cleared at any
 * time") is resolved in exactly one place, not duplicated per DTO writer.
 */
object MediaThumbnailUri {
    fun resolveThumbnail(media: MediaAssetEntity, storage: MediaStorage): String? {
        val thumbnailFile = media.thumbnailPath?.let { storage.thumbnailFileFor(media.id) } ?: return null
        return if (thumbnailFile.exists()) Uri.fromFile(thumbnailFile).toString() else null
    }

    fun resolveSource(media: MediaAssetEntity, storage: MediaStorage): String =
        Uri.fromFile(storage.fileFor(media.storageKey)).toString()
}
