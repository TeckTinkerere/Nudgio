package com.aslam.mediareminder.data.db.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.RawQuery
import androidx.sqlite.db.SupportSQLiteQuery
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity

/**
 * MR-09 `media_assets` access.
 *
 * [queryPage] and [countMatching] take a [SupportSQLiteQuery] rather than being
 * expressed as `@Query` methods. `MediaQuery` (MR-08) carries five independent
 * optional filters and four sort orders; as fixed `@Query` methods that is a
 * combinatorial explosion, and the usual workaround — `(:arg IS NULL OR col =
 * :arg)` plus a `CASE` in `ORDER BY` — produces SQL that SQLite cannot satisfy
 * from the MR-09 indices, because a `CASE` sort key is not an indexable
 * expression.
 *
 * So the SQL is assembled by [com.aslam.mediareminder.data.media.MediaQuerySql],
 * which is deliberately pure: it takes the query object and returns SQL plus
 * bound arguments, with no Android or Room dependency, so its filter and sort
 * behavior is covered by plain JVM unit tests instead of requiring an
 * instrumented device.
 */
@Dao
interface MediaDao {
    @RawQuery(observedEntities = [MediaAssetEntity::class])
    suspend fun queryPage(query: SupportSQLiteQuery): List<MediaAssetEntity>

    /** Total rows matching the same filters, ignoring limit/offset, for `Page.total`. */
    @RawQuery(observedEntities = [MediaAssetEntity::class])
    suspend fun countMatching(query: SupportSQLiteQuery): Int

    @Query("SELECT * FROM media_assets WHERE id = :id")
    suspend fun getById(id: String): MediaAssetEntity?

    /** Batched lookup for a page of reminders' linked media (`ReminderDtoWriter`), same reasoning as [countActiveRemindersFor]. */
    @Query("SELECT * FROM media_assets WHERE id IN (:ids)")
    suspend fun getByIds(ids: List<String>): List<MediaAssetEntity>

    @Query("SELECT * FROM media_assets WHERE storage_key = :storageKey")
    suspend fun getByStorageKey(storageKey: String): MediaAssetEntity?

    /**
     * Duplicate detection on import (MR-09 indexes `sha256` for exactly this).
     * Returns every row with these bytes; the caller decides whether to reuse,
     * warn or import anyway — that policy is MR-05's, not the DAO's.
     */
    @Query("SELECT * FROM media_assets WHERE sha256 = :sha256")
    suspend fun getBySha256(sha256: String): List<MediaAssetEntity>

    @Query("SELECT COUNT(*) FROM media_assets")
    suspend fun count(): Int

    /**
     * `activeReminderCount` for a whole page in one statement.
     *
     * Batched deliberately: asking per row would issue one query per list item
     * on every Library scroll, and MR-15 budgets the Library list on a single
     * bounded read. Media with no active reminder simply has no row in the
     * result — callers default to 0 rather than expecting a zero row back.
     */
    @Query(
        """
        SELECT media_id AS mediaId, COUNT(*) AS activeCount
        FROM reminders
        WHERE effective_state = 'active' AND media_id IN (:mediaIds)
        GROUP BY media_id
        """,
    )
    suspend fun countActiveRemindersFor(mediaIds: List<String>): List<MediaReminderCount>

    /** Projection row for [countActiveRemindersFor]. */
    data class MediaReminderCount(val mediaId: String, val activeCount: Int)

    /**
     * ABORT, not REPLACE: `storage_key` is UNIQUE and a REPLACE would silently
     * delete the row that owns an already-written file, orphaning those bytes
     * on disk with nothing referencing them.
     */
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(asset: MediaAssetEntity)

    @Delete
    suspend fun delete(asset: MediaAssetEntity)

    /**
     * Marks an asset's bytes as no longer trustworthy. Used by integrity
     * re-checks rather than by import; kept as a targeted UPDATE so a check
     * sweep does not have to read, copy and write back whole entities.
     */
    @Query(
        """
        UPDATE media_assets
        SET integrity_state = :integrityState,
            updated_at = :updatedAt,
            entity_version = entity_version + 1
        WHERE id = :id
        """,
    )
    suspend fun updateIntegrityState(id: String, integrityState: String, updatedAt: Long): Int

    /**
     * Rename/notes edit (MR-03 "Edit details"). Optimistic-concurrency, same
     * rule [com.aslam.mediareminder.reminders.ReminderMutationService] already
     * applies to reminders (MR-08 "Event ordering and idempotency"): the
     * caller supplies the version it read, and 0 rows changed means someone
     * else's edit landed first — the caller must reject the save rather than
     * silently overwrite it, not retry blindly.
     */
    @Query(
        """
        UPDATE media_assets
        SET title = :title,
            notes = :notes,
            updated_at = :updatedAt,
            entity_version = entity_version + 1
        WHERE id = :id AND entity_version = :expectedVersion
        """,
    )
    suspend fun updateTitleAndNotes(
        id: String,
        title: String,
        notes: String?,
        updatedAt: Long,
        expectedVersion: Int,
    ): Int

    /**
     * Items thumbnail generation never ran for — every asset imported before
     * `MediaThumbnailer` existed (docs/decision-log.md DL-059's on-device
     * pass found real library rows in exactly this state). `text` is
     * excluded: it has no thumbnail concept, so it would never gain one and
     * would just be swept on every backfill pass for nothing.
     */
    @Query(
        """
        SELECT * FROM media_assets
        WHERE thumbnail_path IS NULL AND kind != 'text'
        """,
    )
    suspend fun getMissingThumbnails(): List<MediaAssetEntity>

    /** The other half of the backfill sweep: rows that claim a thumbnail, so a corrupted (not just missing) cache file can be caught too. */
    @Query(
        """
        SELECT * FROM media_assets
        WHERE thumbnail_path IS NOT NULL AND kind != 'text'
        """,
    )
    suspend fun getWithThumbnails(): List<MediaAssetEntity>

    /** No optimistic-concurrency check: a backfilled thumbnail is derived cache, not user content — see `MediaThumbnailer`'s doc. */
    @Query("UPDATE media_assets SET thumbnail_path = :thumbnailPath WHERE id = :id")
    suspend fun updateThumbnailPath(id: String, thumbnailPath: String)

    /** Clears a corrupted cache reference so the row honestly reflects "no thumbnail" if regeneration also fails. */
    @Query("UPDATE media_assets SET thumbnail_path = NULL WHERE id = :id")
    suspend fun clearThumbnailPath(id: String)
}
