package com.aslam.mediareminder.media

import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.time.Instant

/**
 * Room `media_assets` rows -> MR-08's `MediaSummary`/`MediaDetail` wire shapes
 * (`src/native-client/types.ts`).
 *
 * Three fields are honestly absent rather than faked, each for a structural
 * reason that will be removed by a later slice:
 *
 *  - `category` — the `categories` table does not exist yet, so
 *    `media_assets.category_id` has nothing to resolve a name from. Emitted as
 *    null rather than as an object with a placeholder name, because a
 *    fabricated name would show up verbatim in the Library's category chips.
 *  - `tags` — same reason; emitted as an empty array, which is what the DTO
 *    declares for "no tags" anyway, so no consumer needs to special-case it.
 *  - `thumbnailToken` — omitted until the WebP thumbnail cache exists (MR-09
 *    "Derived thumbnails are WebP cache"). The field is optional in the DTO and
 *    `MediaCard` already renders a kind icon when it is absent.
 *
 * `sizeBytes` is a decimal *string*, not a number: MR-08 is explicit that a
 * media file can exceed `Number.MAX_SAFE_INTEGER` in bytes, and the TS side
 * brands it as `ByteCount` for exactly that reason.
 */
object MediaDtoWriter {

    fun writeSummary(entity: MediaAssetEntity, activeReminderCount: Int): WritableMap =
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
    fun writeDetail(entity: MediaAssetEntity, activeReminderCount: Int): WritableMap {
        val map = writeSummary(entity, activeReminderCount)
        val notes = entity.notes
        if (notes != null) map.putString("notes", notes) else map.putNull("notes")
        map.putString("mimeType", entity.mimeType)
        if (entity.widthPx != null) map.putInt("widthPx", entity.widthPx)
        if (entity.heightPx != null) map.putInt("heightPx", entity.heightPx)
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
    ): WritableMap = Arguments.createMap().apply {
        val array = Arguments.createArray()
        items.forEach { array.pushMap(writeSummary(it, counts[it.id] ?: 0)) }
        putArray("items", array)
        putInt("total", total)
        putInt("offset", offset)
        // Derived, never passed in: `hasMore` and `total` disagreeing is the
        // bug that makes a list either stop early or paginate forever.
        putBoolean("hasMore", offset + items.size < total)
    }
}
