package com.aslam.mediareminder.media

import androidx.sqlite.db.SimpleSQLiteQuery
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.aslam.mediareminder.data.media.MediaQuerySql
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap

/**
 * Read side of the media library (MR-08 `listMedia`/`getMedia`).
 *
 * Sits between the bridge module and Room so [com.aslam.mediareminder.bridge.MediaReminderModule]
 * stays a thin translation layer: parse the `ReadableMap`, hand over a typed
 * criteria object, get a `WritableMap` back. The SQL itself lives in the pure
 * [MediaQuerySql] so it is unit-testable without a device; this class is only
 * the Room plumbing that pure builder cannot do.
 */
class MediaLibraryService(private val database: MediaReminderDatabase) {

    private val mediaDao get() = database.mediaDao()

    /**
     * Translates MR-08's `MediaQuery` wire object into [MediaQuerySql.Criteria].
     *
     * Unknown or absent fields fall back to the DTO's documented defaults rather
     * than rejecting: `MediaQuery` declares every field optional, so an empty
     * map is a legitimate "first page, most recent first" request.
     */
    fun criteriaFrom(query: ReadableMap?): MediaQuerySql.Criteria {
        if (query == null) return MediaQuerySql.Criteria()

        val kinds = mutableListOf<String>()
        if (query.hasKey("kinds")) {
            query.getArray("kinds")?.let { array ->
                for (i in 0 until array.size()) {
                    array.getString(i)?.let { kinds.add(it) }
                }
            }
        }

        return MediaQuerySql.Criteria(
            search = query.takeIf { it.hasKey("search") }?.getString("search"),
            kinds = kinds,
            categoryId = query.takeIf { it.hasKey("categoryId") }?.getString("categoryId"),
            onlyMissing = query.hasKey("onlyMissing") && query.getBoolean("onlyMissing"),
            sort = query.takeIf { it.hasKey("sort") }?.getString("sort")
                ?: MediaQuerySql.SORT_RECENT,
            offset = if (query.hasKey("offset")) query.getInt("offset") else 0,
            limit = if (query.hasKey("limit")) {
                query.getInt("limit")
            } else {
                MediaQuerySql.DEFAULT_LIMIT
            },
        )
    }

    suspend fun listMedia(criteria: MediaQuerySql.Criteria): WritableMap {
        val pageSql = MediaQuerySql.page(criteria)
        val countSql = MediaQuerySql.count(criteria)

        val items = mediaDao.queryPage(
            SimpleSQLiteQuery(pageSql.sql, pageSql.args.toTypedArray()),
        )
        val total = mediaDao.countMatching(
            SimpleSQLiteQuery(countSql.sql, countSql.args.toTypedArray()),
        )

        return MediaDtoWriter.writePage(
            items = items,
            counts = activeReminderCounts(items),
            total = total,
            offset = criteria.offset.coerceAtLeast(0),
        )
    }

    /** `null` when no asset has this id, so the caller can reject with a not-found envelope. */
    suspend fun getMedia(id: String): WritableMap? {
        val entity = mediaDao.getById(id) ?: return null
        val counts = activeReminderCounts(listOf(entity))
        return MediaDtoWriter.writeDetail(entity, counts[entity.id] ?: 0)
    }

    private suspend fun activeReminderCounts(items: List<MediaAssetEntity>): Map<String, Int> {
        if (items.isEmpty()) return emptyMap()
        return mediaDao
            .countActiveRemindersFor(items.map { it.id })
            .associate { it.mediaId to it.activeCount }
    }
}
