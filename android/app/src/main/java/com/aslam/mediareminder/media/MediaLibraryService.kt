package com.aslam.mediareminder.media

import android.content.Intent
import androidx.sqlite.db.SimpleSQLiteQuery
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.aslam.mediareminder.data.media.MediaQuerySql
import com.aslam.mediareminder.data.media.MediaRename
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import java.time.Instant

/**
 * Read side of the media library (MR-08 `listMedia`/`getMedia`).
 *
 * Sits between the bridge module and Room so [com.aslam.mediareminder.bridge.MediaReminderModule]
 * stays a thin translation layer: parse the `ReadableMap`, hand over a typed
 * criteria object, get a `WritableMap` back. The SQL itself lives in the pure
 * [MediaQuerySql] so it is unit-testable without a device; this class is only
 * the Room plumbing that pure builder cannot do.
 */
class MediaLibraryService(private val database: MediaReminderDatabase, private val storage: MediaStorage) {

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
            storage = storage,
        )
    }

    /** `null` when no asset has this id, so the caller can reject with a not-found envelope. */
    suspend fun getMedia(id: String): WritableMap? {
        val entity = mediaDao.getById(id) ?: return null
        val counts = activeReminderCounts(listOf(entity))
        return MediaDtoWriter.writeDetail(entity, counts[entity.id] ?: 0, storage)
    }

    /**
     * MR-08 `updateMedia` / MR-03 "Edit details": rename and/or edit notes.
     * `request` fields are all optional except `id` — an absent `title`/`notes`
     * key means "leave this field alone," not "clear it," so a caller that only
     * wants to rename never has to first re-supply the existing notes.
     */
    suspend fun updateMedia(request: ReadableMap): UpdateMediaOutcome {
        val id = request.getString("id") ?: return UpdateMediaOutcome.Invalid("id")
        val existing = mediaDao.getById(id) ?: return UpdateMediaOutcome.NotFound

        val resolved = MediaRename.resolve(
            existingTitle = existing.title,
            existingNotes = existing.notes,
            requestedTitle = if (request.hasKey("title")) request.getString("title") else null,
            requestedNotesTrimmed = if (request.hasKey("notes")) request.getString("notes")?.trim() else null,
            notesKeyPresent = request.hasKey("notes"),
        )
        val (finalTitle, finalNotes) = when (resolved) {
            is MediaRename.Result.Invalid -> return UpdateMediaOutcome.Invalid(resolved.field)
            is MediaRename.Result.Ok -> resolved.title to resolved.notes
        }

        val rows = mediaDao.updateTitleAndNotes(
            id = id,
            title = finalTitle,
            notes = finalNotes,
            updatedAt = Instant.now().toEpochMilli(),
            expectedVersion = existing.entityVersion,
        )
        if (rows == 0) {
            // Lost a race against a concurrent edit of the same row between
            // the read above and this write — same discipline
            // ReminderMutationService.save() already applies to reminders.
            return UpdateMediaOutcome.Conflict
        }

        val updated = mediaDao.getById(id) ?: return UpdateMediaOutcome.NotFound
        val counts = activeReminderCounts(listOf(updated))
        return UpdateMediaOutcome.Success(MediaDtoWriter.writeDetail(updated, counts[updated.id] ?: 0, storage))
    }

    sealed class UpdateMediaOutcome {
        data class Success(val detail: WritableMap) : UpdateMediaOutcome()
        object NotFound : UpdateMediaOutcome()
        data class Invalid(val field: String) : UpdateMediaOutcome()
        object Conflict : UpdateMediaOutcome()
    }

    /**
     * MR-03 "Delete": every deleted asset's bytes and cached thumbnail come
     * off disk immediately, not just its DB row — the whole point of the
     * user-facing delete flow is that removed media stops counting against
     * app storage, not that it becomes merely unlisted. `File.delete()` is a
     * safe no-op (returns `false`) when a path is already missing, so a
     * previously "missing" asset (source file already gone, per
     * `IntegrityState`) deletes cleanly too.
     */
    suspend fun attachedReminderIds(id: String): List<String> =
        database.reminderDao().getByMediaId(id).map { it.id }

    suspend fun deleteMedia(request: ReadableMap): DeleteMediaOutcome {
        val id = request.takeIf { it.hasKey("id") }?.getString("id")
            ?: return DeleteMediaOutcome.Invalid("id")
        val existing = mediaDao.getById(id) ?: return DeleteMediaOutcome.NotFound

        mediaDao.delete(existing)
        storage.fileFor(existing.storageKey).delete()
        storage.thumbnailFileFor(existing.id).delete()

        return DeleteMediaOutcome.Success
    }

    sealed class DeleteMediaOutcome {
        object Success : DeleteMediaOutcome()
        object NotFound : DeleteMediaOutcome()
        data class Invalid(val field: String) : DeleteMediaOutcome()
    }

    /**
     * Library "Export selected" (MR-10 "Sharing and privacy"). There is no
     * native "export a subset" archive format — that is `BackupExporter`'s
     * whole-library ZIP, a distinct feature. This hands the selected files'
     * real bytes to the OS share sheet instead (`ACTION_SEND_MULTIPLE`,
     * read-only `content://` grants via `MediaStorage.contentUriFor`), which
     * is what "export" means for a multi-select action in most gallery apps:
     * the app's job ends once the chooser opens, not once some other app
     * finishes receiving the files. `null` means none of the requested ids
     * resolved to a still-existing file — nothing to share.
     */
    suspend fun buildExportIntent(ids: List<String>): Intent? {
        val entities = mediaDao.getByIds(ids)
        val uris = entities
            .map { storage.fileFor(it.storageKey) }
            .filter { it.exists() }
            .map { storage.contentUriFor(it) }
        if (uris.isEmpty()) return null

        val kinds = entities.map { it.kind }.toSet()
        val mimeType = if (kinds.size == 1) MIME_TYPE_PREFIX[kinds.first()] ?: "*/*" else "*/*"

        return Intent(Intent.ACTION_SEND_MULTIPLE).apply {
            type = mimeType
            putParcelableArrayListExtra(Intent.EXTRA_STREAM, ArrayList(uris))
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    /**
     * One-time, best-effort catch-up for assets imported before thumbnail
     * generation existed, or where it failed on the first try (see
     * `MediaDao.getMissingThumbnails`'s doc — real library rows were found
     * in exactly this state, docs/decision-log.md). Runs off the hot list/
     * detail query path entirely (triggered once from
     * `MediaReminderModule`'s init) so it never adds thumbnail-generation
     * latency to an ordinary grid/detail fetch; the JS side picks up a
     * newly-backfilled thumbnail the next time it refetches that query
     * (list focus/navigation, or the next app start at worst).
     *
     * Two passes: rows with no cached thumbnail at all, then rows that
     * claim one but whose file is missing or fails to decode (`MediaThumbnailer
     * .isValid`) — a truncated write or storage fault can leave `thumbnail_path`
     * pointing at bytes that were never a real cache hit, and nothing before
     * this ever re-checked a path once it was set.
     */
    suspend fun backfillMissingThumbnails() {
        for (entity in mediaDao.getMissingThumbnails()) {
            regenerateThumbnail(entity)
        }
        for (entity in mediaDao.getWithThumbnails()) {
            if (!MediaThumbnailer.isValid(storage.thumbnailFileFor(entity.id))) {
                regenerateThumbnail(entity)
            }
        }
    }

    private suspend fun regenerateThumbnail(entity: MediaAssetEntity) {
        val sourceFile = storage.fileFor(entity.storageKey)
        val thumbnailFile = storage.thumbnailFileFor(entity.id)
        if (sourceFile.exists() && MediaThumbnailer.generate(sourceFile, entity.kind, thumbnailFile)) {
            mediaDao.updateThumbnailPath(entity.id, thumbnailFile.name)
        } else {
            thumbnailFile.delete()
            mediaDao.clearThumbnailPath(entity.id)
        }
    }

    private suspend fun activeReminderCounts(items: List<MediaAssetEntity>): Map<String, Int> {
        if (items.isEmpty()) return emptyMap()
        return mediaDao
            .countActiveRemindersFor(items.map { it.id })
            .associate { it.mediaId to it.activeCount }
    }

    companion object {
        private val MIME_TYPE_PREFIX = mapOf(
            MediaAssetEntity.KIND_VIDEO to "video/*",
            MediaAssetEntity.KIND_AUDIO to "audio/*",
            MediaAssetEntity.KIND_IMAGE to "image/*",
            MediaAssetEntity.KIND_TEXT to "text/*",
        )
    }
}
