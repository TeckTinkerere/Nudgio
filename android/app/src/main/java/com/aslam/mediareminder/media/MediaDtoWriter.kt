package com.aslam.mediareminder.media

import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.time.Instant

/**
 * Room `media_assets` rows -> MR-08's `MediaSummary`/`MediaDetail` wire shapes
 * (`src/native-client/types.ts`).
 *
 * Two fields are honestly absent rather than faked, both for a structural
 * reason that will be removed by a later slice:
 *
 *  - `category` — the `categories` table does not exist yet, so
 *    `media_assets.category_id` has nothing to resolve a name from. Emitted as
 *    null rather than as an object with a placeholder name, because a
 *    fabricated name would show up verbatim in the Library's category chips.
 *  - `tags` — same reason; emitted as an empty array, which is what the DTO
 *    declares for "no tags" anyway, so no consumer needs to special-case it.
 *
 * `thumbnailToken`/`sourceToken` are MR-08's "opaque app-local token consumed
 * by an image provider... not an absolute path" — enforced on the TS side by
 * branding (`ThumbnailToken`/`MediaSourceToken` are nominal types distinct
 * from `string`, so no UI code can treat one as an arbitrary URL without
 * going through the one adapter that unwraps it, `src/native-client/mediaTokens.ts`).
 * Their *runtime* value is a `file://` URI into this app's own private
 * storage — safe to hand directly to `Image`/`Video` since both already
 * resolve `file://` without any content-provider indirection, and nothing
 * outside this process ever receives it. `thumbnailToken` is additionally
 * existence-checked before being emitted: MR-09 "Derived thumbnails are WebP
 * cache and may be cleared at any time," so a stale path is treated the same
 * as "never generated" rather than shipped and left to fail at image-load
 * time. `sourceToken` (the original asset) is not existence-checked here —
 * that's `integrity`'s job (`INTEGRITY_MISSING`), a distinct, already-tracked
 * concept.
 *
 * `sizeBytes` is a decimal *string*, not a number: MR-08 is explicit that a
 * media file can exceed `Number.MAX_SAFE_INTEGER` in bytes, and the TS side
 * brands it as `ByteCount` for exactly that reason.
 */
object MediaDtoWriter {

    fun writeSummary(entity: MediaAssetEntity, activeReminderCount: Int, storage: MediaStorage): WritableMap =
        Arguments.createMap().apply {
            putString("id", entity.id)
            putString("kind", entity.kind)
            putString("title", entity.title)
            if (entity.durationMs != null) {
                // Safe as an Int-typed bridge value only because durations are
                // milliseconds and fit comfortably; sizes are not, hence the
                // string treatment below.
                putDouble("durationMs", entity.durationMs.toDouble())
            }
            putString("sizeBytes", entity.sizeBytes.toString())
            val thumbnailToken = MediaThumbnailUri.resolveThumbnail(entity, storage)
            if (thumbnailToken != null) putString("thumbnailToken", thumbnailToken) else putNull("thumbnailToken")
            putString("sourceToken", MediaThumbnailUri.resolveSource(entity, storage))
            // The Library grid needs real dimensions on every card, not just
            // the detail view, to render each thumbnail at its own natural
            // aspect ratio instead of a fixed 16:9/square crop.
            if (entity.widthPx != null) putInt("widthPx", entity.widthPx) else putNull("widthPx")
            if (entity.heightPx != null) putInt("heightPx", entity.heightPx) else putNull("heightPx")
            putNull("category")
            putArray("tags", Arguments.createArray())
            putInt("activeReminderCount", activeReminderCount)
            putString("integrity", entity.integrityState)
            putString("createdAt", Instant.ofEpochMilli(entity.createdAt).toString())
        }

    /**
     * Extends [writeSummary]'s map with `MediaDetail`'s extra fields — a
     * `WritableNativeMap` accepts further `put*` calls right up until
     * `promise.resolve()` consumes it, the same approach
     * [com.aslam.mediareminder.reminders.ReminderDtoWriter.writeDetail] uses.
     */
    fun writeDetail(entity: MediaAssetEntity, activeReminderCount: Int, storage: MediaStorage): WritableMap {
        val map = writeSummary(entity, activeReminderCount, storage)
        val notes = entity.notes
        if (notes != null) map.putString("notes", notes) else map.putNull("notes")
        map.putString("mimeType", entity.mimeType)
        map.putString("updatedAt", Instant.ofEpochMilli(entity.updatedAt).toString())
        map.putInt("entityVersion", entity.entityVersion)
        return map
    }

    /** MR-08 `Page<MediaSummary>`. */
    fun writePage(
        items: List<MediaAssetEntity>,
        counts: Map<String, Int>,
        total: Int,
        offset: Int,
        storage: MediaStorage,
    ): WritableMap = Arguments.createMap().apply {
        val array = Arguments.createArray()
        items.forEach { array.pushMap(writeSummary(it, counts[it.id] ?: 0, storage)) }
        putArray("items", array)
        putInt("total", total)
        putInt("offset", offset)
        // Derived, never passed in: `hasMore` and `total` disagreeing is the
        // bug that makes a list either stop early or paginate forever.
        putBoolean("hasMore", offset + items.size < total)
    }
}
