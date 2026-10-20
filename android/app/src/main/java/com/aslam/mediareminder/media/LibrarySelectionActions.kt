package com.aslam.mediareminder.media

import android.content.Context
import android.content.Intent
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * The two bulk actions on a Library selection (media and whole folders):
 * Share, and Save to the device gallery.
 *
 * **Share.** One file chosen on its own goes straight to the share sheet.
 * Anything else, meaning two or more files or any folder, is zipped first
 * ([ShareZipWriter]) with the Library's folder structure, so the receiver
 * gets one file that keeps the organisation. The zip is built in the app's
 * private cache, never in external storage (SEC-01: other apps can read it
 * there), shared by read-only `content://` grant, and replaced by the next
 * share, so at most one stays on disk.
 *
 * **Save to gallery.** Copies into `Pictures|Movies|Music/Nudgio`, with a
 * Library folder becoming a sub-folder, only when the user asks (DL-101). A
 * file already saved with the same name and size is skipped, so saving the
 * same selection twice does not duplicate it.
 */
class LibrarySelectionActions(
    private val context: Context,
    private val database: MediaReminderDatabase,
    private val storage: MediaStorage,
) {

    sealed class ShareOutcome {
        data class Ready(val intent: Intent, val fileCount: Int) : ShareOutcome()
        object NothingToShare : ShareOutcome()
        object NoSpace : ShareOutcome()
    }

    data class GallerySaveSummary(
        val saved: Int,
        val alreadySaved: Int,
        val failed: Int,
        val unsupported: Int,
        /** False below API 29, where saving needs a broad storage permission this app does not request. */
        val platformSupported: Boolean,
        val noSpace: Boolean = false,
    )

    suspend fun buildShare(mediaIds: List<String>, folderIds: List<String>): ShareOutcome =
        withContext(Dispatchers.IO) {
            val files = resolve(mediaIds, folderIds)
            if (files.isEmpty()) return@withContext ShareOutcome.NothingToShare

            if (files.size == 1 && folderIds.isEmpty()) {
                val only = files.single()
                val uri = storage.contentUriFor(storage.fileFor(only.asset.storageKey))
                return@withContext ShareOutcome.Ready(
                    Intent(Intent.ACTION_SEND).apply {
                        type = only.asset.mimeType.ifBlank { "*/*" }
                        putExtra(Intent.EXTRA_STREAM, uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    },
                    1,
                )
            }

            val sources = files.map { storage.fileFor(it.asset.storageKey) }
            if (!storage.ensureRoomFor(sources.sumOf { it.length() })) return@withContext ShareOutcome.NoSpace

            val dir = shareDir()
            dir.listFiles()?.forEach { it.delete() }
            val zip = File(dir, "Nudgio_${STAMP.format(Instant.now())}.zip")
            val written = ShareZipWriter.write(
                files.mapIndexed { index, file -> ShareZipWriter.Entry(file.path, sources[index], file.asset.createdAt) },
                zip,
            )
            if (written == 0) return@withContext ShareOutcome.NothingToShare

            ShareOutcome.Ready(
                Intent(Intent.ACTION_SEND).apply {
                    type = "application/zip"
                    putExtra(Intent.EXTRA_STREAM, storage.contentUriFor(zip))
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                },
                written,
            )
        }

    suspend fun saveToGallery(mediaIds: List<String>, folderIds: List<String>): GallerySaveSummary =
        withContext(Dispatchers.IO) {
            if (!MediaStoreExporter.isSupported()) {
                return@withContext GallerySaveSummary(0, 0, 0, 0, platformSupported = false)
            }
            var unsupported = 0
            var alreadySaved = 0
            val toCopy = mutableListOf<NamedFile>()
            for (file in resolve(mediaIds, folderIds)) {
                val source = storage.fileFor(file.asset.storageKey)
                when {
                    MediaStoreExporter.collectionFor(file.asset.kind) == null -> unsupported += 1
                    MediaStoreExporter.alreadySaved(context, file.asset, file.directory, file.fileName, source.length()) ->
                        alreadySaved += 1
                    else -> toCopy += file
                }
            }
            if (toCopy.isNotEmpty() && !storage.ensureRoomFor(toCopy.sumOf { storage.fileFor(it.asset.storageKey).length() })) {
                return@withContext GallerySaveSummary(0, alreadySaved, 0, unsupported, platformSupported = true, noSpace = true)
            }

            var saved = 0
            var failed = 0
            for (file in toCopy) {
                val uri = MediaStoreExporter.saveCopy(
                    context, file.asset, storage.fileFor(file.asset.storageKey), file.directory, file.fileName,
                )
                if (uri != null) saved += 1 else failed += 1
            }
            GallerySaveSummary(saved, alreadySaved, failed, unsupported, platformSupported = true)
        }

    /** Deletes a share zip left from an earlier run. The cache is the OS's to clear too, so this is housekeeping. */
    fun sweepShareZips(): Int = shareDir().listFiles()?.count { it.delete() } ?: 0

    private fun shareDir(): File = File(context.cacheDir, SHARE_DIR_NAME).apply { mkdirs() }

    /** Files that exist on disk, named and placed; a missing one is dropped, not failed on. */
    private suspend fun resolve(mediaIds: List<String>, folderIds: List<String>): List<NamedFile> {
        val dao = database.mediaDao()
        val libraryDao = database.libraryDao()
        // SQLite caps bound variables at 999; past a few hundred ids reading
        // every row is simpler and no slower for a Library this size.
        val assets = if (folderIds.isEmpty() && mediaIds.size <= MAX_ID_QUERY) dao.getByIds(mediaIds) else dao.getAll()
        val planned = SelectionPlanner.plan(
            mediaIds = mediaIds,
            folderIds = folderIds,
            folders = if (folderIds.isEmpty()) emptyList() else libraryDao.folders(),
            memberships = if (folderIds.isEmpty()) emptyList() else libraryDao.memberships(),
            assets = assets,
        )
        return SelectionPlanner.nameFiles(planned.filter { storage.fileFor(it.asset.storageKey).exists() })
    }

    private companion object {
        const val SHARE_DIR_NAME = "share"
        const val MAX_ID_QUERY = 500
        val STAMP: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd_HHmmss").withZone(ZoneId.systemDefault())
    }
}
