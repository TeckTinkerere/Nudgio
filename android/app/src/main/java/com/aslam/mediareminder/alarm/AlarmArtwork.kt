package com.aslam.mediareminder.alarm

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.aslam.mediareminder.media.MediaStorage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Loads a reminder's cached thumbnail for the two alarm surfaces that show
 * one: [AlarmActivity]'s preview card/backdrop and the due notification's
 * large icon and expanded picture.
 *
 * It exists because both of those got the file path wrong in the same way.
 * `MediaAssetEntity.thumbnailPath` is not a path — the importer stores
 * `thumbnailFile.name`, i.e. bare `<id>.webp` — so `File(thumbnailPath)`
 * resolves against the process working directory, never exists, and the
 * artwork silently never appeared. [MediaStorage.thumbnailFileFor] is the
 * only correct way to turn that column into a file, exactly as
 * [com.aslam.mediareminder.media.MediaThumbnailUri] already does for the
 * DTO writers. One helper, so a third caller cannot reintroduce it.
 *
 * Always decodes on [Dispatchers.IO]: one caller ([AlarmRingingService]) is
 * on the main dispatcher, and this runs at the exact moment an alarm is
 * coming up, where a blocked frame is most visible.
 *
 * A missing or unreadable thumbnail is not an error — MR-09 makes the
 * thumbnail cache reclaimable at any time — so every failure path returns
 * null and the callers fall back to a design that never assumed a picture.
 */
object AlarmArtwork {

    suspend fun load(context: Context, media: MediaAssetEntity?): Bitmap? {
        val asset = media ?: return null
        if (asset.thumbnailPath.isNullOrBlank()) return null
        return withContext(Dispatchers.IO) {
            runCatching {
                val file = MediaStorage(context).thumbnailFileFor(asset.id)
                if (file.exists()) BitmapFactory.decodeFile(file.absolutePath) else null
            }.getOrNull()
        }
    }
}
