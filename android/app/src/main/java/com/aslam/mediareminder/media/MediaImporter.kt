package com.aslam.mediareminder.media

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.aslam.mediareminder.data.db.entity.OperationJournalEntity
import com.aslam.mediareminder.data.media.MediaKinds
import com.aslam.mediareminder.diagnostics.NativeLogger
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

/**
 * MR-05 "Import transaction": the numbered eight-step algorithm, implemented
 * as one linear function so the step order in code matches the spec's step
 * order exactly.
 *
 * Deliberately not split into micro-methods per step — every step after the
 * first depends on a value only the previous step produces (the storage key
 * before the stream, the digest before the rename, the final file before the
 * probe), so factoring them apart would need most of them to accept and
 * return the same handful of values anyway. The suspend-function-with-clear-
 * numbered-comments shape here matches [com.aslam.mediareminder.backup.BackupImporter.stage]'s
 * own style for the same reason.
 */
class MediaImporter(
    private val context: Context,
    private val database: MediaReminderDatabase,
    private val storage: MediaStorage = MediaStorage(context),
) {
    private val mediaDao get() = database.mediaDao()
    private val journalDao get() = database.operationJournalDao()

    @Suppress("LongParameterList")
    suspend fun import(
        operationId: String,
        sourceUri: String,
        displayName: String?,
        mimeType: String?,
        declaredSizeBytes: Long?,
        onProgress: suspend (phase: String, completedBytes: Long?, totalBytes: Long?) -> Unit,
        isCancelled: () -> Boolean,
    ): MediaAssetEntity {
        val now = Instant.now().toEpochMilli()

        // Step 5 in MR-05's numbering is "probe", but classifying the *kind*
        // (video/audio/image/text vs. none of those) has to happen before any
        // bytes move — there is no point streaming a multi-gigabyte file only
        // to discover its top-level MIME group is not one we support at all.
        // This is a coarse group check only ("is this roughly a video"), not
        // the codec-level support decision — that is still MediaProbe's job
        // after the copy, matching MR-05's "extensions/MIME MUST NOT be
        // trusted as the sole type check."
        val kind = MediaKinds.kindOf(mimeType)
            ?: throw MediaImportException(MediaImportException.UNSUPPORTED_TYPE, "Unsupported MIME type: $mimeType")

        // MR-05 step 4, the part checkable before copying: reject upfront when
        // the provider-declared size already will not fit. An unknown declared
        // size (some providers report none) skips this and relies entirely on
        // the running hard cap enforced during the copy loop below — that cap
        // applies unconditionally either way.
        if (declaredSizeBytes != null) {
            if (declaredSizeBytes > MediaStorage.MAX_ASSET_BYTES) {
                throw MediaImportException(MediaImportException.TOO_LARGE, "Declared size $declaredSizeBytes exceeds the v1 per-asset limit")
            }
            val mediaDir = storage.mediaDir()
            if (!MediaStorage.hasRoomFor(declaredSizeBytes, mediaDir.usableSpace, mediaDir.totalSpace)) {
                throw MediaImportException(MediaImportException.STORAGE_INSUFFICIENT, "Not enough free space for $declaredSizeBytes bytes")
            }
        }

        // Step 1: pending-operation record and a random temporary filename.
        // The storage key is generated now, before the stream opens, so the
        // journal's `stagingPath` can point at the exact `.part` file this
        // attempt is about to write — a crash between here and the rename
        // leaves a journal row that names precisely which orphan to sweep.
        val storageKey = storage.newStorageKey(mimeType)
        val partialFile = storage.partialFor(storageKey)
        journalDao.upsert(
            OperationJournalEntity(
                id = operationId,
                kind = "import",
                phase = OperationJournalEntity.Phase.MEDIA_COPYING,
                stagingPath = partialFile.absolutePath,
                createdAt = now,
                updatedAt = now,
            ),
        )

        val sha256 = try {
            // Steps 2-4: open the content URI, stream into private storage
            // with a bounded buffer while hashing, abort over the hard cap.
            // Returned rather than stashed on `this`: `MediaReminderModule`
            // holds one `MediaImporter` instance for the module's lifetime, and
            // two imports can run concurrently on `Dispatchers.IO` — an
            // instance field here would let a fast, small import's digest
            // clobber a slower, larger one running at the same time.
            copyAndHash(sourceUri, partialFile, declaredSizeBytes, onProgress, isCancelled)
        } catch (cancelled: MediaImportCancelledException) {
            failOperation(operationId, "cancelled", isCancellation = true)
            partialFile.delete()
            throw cancelled
        } catch (mediaError: MediaImportException) {
            failOperation(operationId, mediaError.reasonCode)
            partialFile.delete()
            throw mediaError
        } catch (error: Exception) {
            failOperation(operationId, MediaImportException.WRITE_FAILED)
            partialFile.delete()
            throw MediaImportException(MediaImportException.WRITE_FAILED, "Could not read or write the selected file")
        }

        val copiedBytes = partialFile.length()

        // Duplicate reuse, checked here rather than after the rename: the
        // digest is known, so an identical asset can be answered without
        // probing, thumbnailing or even naming the new file. MR-05's step
        // order is unchanged for a genuine import; this is a short circuit
        // ahead of step 6, not a reordering of it.
        //
        // The copy itself still happens. Hashing the source *before* copying
        // would mean reading every byte twice to save the duplicate case,
        // and the brief's own constraint is not to re-hash enormous videos
        // needlessly — one read that both copies and hashes is the cheaper
        // trade, and the redundant bytes are released immediately below.
        val duplicate = findReusableDuplicate(sha256, copiedBytes)
        if (duplicate != null) {
            partialFile.delete()
            markPhase(
                operationId,
                OperationJournalEntity.Phase.COMPLETE,
                resultSummary = JSONObject().apply {
                    put("mediaId", duplicate.id)
                    put("kind", duplicate.kind)
                    put("reusedExisting", true)
                }.toString(),
            )
            onProgress(ProgressPhase.READY, copiedBytes, copiedBytes)
            NativeLogger.debug(
                "media.import.reusedDuplicate",
                mapOf("mediaId" to duplicate.id, "bytesReclaimed" to copiedBytes),
            )
            return duplicate
        }

        // Step 6: fsync, then atomically rename into the final key. `renameTo`
        // is atomic within one filesystem, and both files live under the same
        // app-private `media/` directory, so this never crosses a mount point.
        val finalFile = storage.fileFor(storageKey)
        if (!partialFile.renameTo(finalFile)) {
            failOperation(operationId, MediaImportException.WRITE_FAILED)
            partialFile.delete()
            throw MediaImportException(MediaImportException.WRITE_FAILED, "Could not finalize the imported file")
        }

        markPhase(operationId, OperationJournalEntity.Phase.MEDIA_PROBING)
        onProgress(ProgressPhase.CHECKING, copiedBytes, copiedBytes)

        // Step 5 (the codec-level half): probe the finished file.
        val probe = MediaProbe.probe(finalFile, kind)

        onProgress(ProgressPhase.CREATING_PREVIEW, copiedBytes, copiedBytes)

        // Step 8, moved ahead of the row insert (still after probing) so the
        // very first read of the new row already carries a thumbnail path
        // when generation succeeds — no separate "backfill thumbnail" update
        // needed. A failure here is silent by design (see MediaThumbnailer's
        // doc): the asset below is inserted either way.
        val assetId = UUID.randomUUID().toString()
        val thumbnailFile = storage.thumbnailFileFor(assetId)
        val thumbnailPath = if (MediaThumbnailer.generate(finalFile, kind, thumbnailFile)) {
            thumbnailFile.name
        } else {
            null
        }

        // Step 7: insert the media record and complete the pending operation.
        // These are not one SQL transaction spanning the journal and
        // media_assets tables — ADR-016's outbox pattern accepts that gap
        // deliberately: if the process dies between the two upserts below,
        // startup recovery (TODO.md) finds a MEDIA_PROBING/MEDIA_COPYING
        // journal row whose file exists but has no media_assets row, which is
        // recoverable (insert the row from the finished file) rather than
        // silently orphaned, unlike the reverse ordering (row before file
        // exists) which would be unrecoverable.
        val asset = MediaAssetEntity(
            id = assetId,
            kind = kind,
            title = MediaKinds.titleFrom(displayName, kind),
            notes = null,
            storageKey = storageKey,
            mimeType = MediaKinds.normalize(mimeType),
            sizeBytes = copiedBytes,
            sha256 = sha256,
            durationMs = probe.durationMs,
            widthPx = probe.widthPx,
            heightPx = probe.heightPx,
            categoryId = null,
            integrityState = probe.integrityState,
            createdAt = now,
            updatedAt = Instant.now().toEpochMilli(),
            thumbnailPath = thumbnailPath,
        )
        mediaDao.insert(asset)

        markPhase(
            operationId,
            OperationJournalEntity.Phase.COMPLETE,
            resultSummary = JSONObject().apply {
                put("mediaId", asset.id)
                put("kind", asset.kind)
            }.toString(),
        )
        onProgress(ProgressPhase.READY, copiedBytes, copiedBytes)

        return asset
    }

    /**
     * Points an existing media record at new bytes, keeping its identity.
     *
     * The recovery action for an asset whose file is gone
     * (`11_Edge_Cases...md`: *"Offer Locate replacement, Restore backup or
     * Delete"*). Keeping the same `id` is the whole point: every reminder
     * referencing this asset is repaired by one action, where replacing the
     * media reminder-by-reminder would mean editing each of them.
     *
     * Deliberately skips the duplicate short circuit [findReusableDuplicate]
     * applies to a fresh import — reusing another row's file here would mean
     * two rows sharing one `storage_key`, which is UNIQUE, and the user's
     * intent is to give *this* record bytes, not to be redirected to another
     * record that happens to hold them.
     *
     * Title and notes are preserved: they are what the user's reminders
     * refer to, and the point of a replacement is that the thing keeps its
     * meaning. `kind` and the probe results do change — replacing a photo
     * with a video is a choice the user is allowed to make.
     *
     * The old file is deleted only after the row write succeeds, so a
     * failure anywhere leaves the record pointing at bytes that still exist.
     */
    @Suppress("LongParameterList")
    suspend fun replaceSource(
        operationId: String,
        mediaId: String,
        sourceUri: String,
        mimeType: String?,
        declaredSizeBytes: Long?,
        onProgress: suspend (phase: String, completedBytes: Long?, totalBytes: Long?) -> Unit,
        isCancelled: () -> Boolean,
    ): MediaAssetEntity {
        val existing = mediaDao.getById(mediaId)
            ?: throw MediaImportException(MediaImportException.SOURCE_UNREADABLE, "No such media record: $mediaId")
        val now = Instant.now().toEpochMilli()

        val kind = MediaKinds.kindOf(mimeType)
            ?: throw MediaImportException(MediaImportException.UNSUPPORTED_TYPE, "Unsupported MIME type: $mimeType")

        if (declaredSizeBytes != null) {
            if (declaredSizeBytes > MediaStorage.MAX_ASSET_BYTES) {
                throw MediaImportException(MediaImportException.TOO_LARGE, "Declared size $declaredSizeBytes exceeds the v1 per-asset limit")
            }
            val mediaDir = storage.mediaDir()
            if (!MediaStorage.hasRoomFor(declaredSizeBytes, mediaDir.usableSpace, mediaDir.totalSpace)) {
                throw MediaImportException(MediaImportException.STORAGE_INSUFFICIENT, "Not enough free space for $declaredSizeBytes bytes")
            }
        }

        val storageKey = storage.newStorageKey(mimeType)
        val partialFile = storage.partialFor(storageKey)
        journalDao.upsert(
            OperationJournalEntity(
                id = operationId,
                kind = "import",
                phase = OperationJournalEntity.Phase.MEDIA_COPYING,
                stagingPath = partialFile.absolutePath,
                createdAt = now,
                updatedAt = now,
            ),
        )

        val sha256 = try {
            copyAndHash(sourceUri, partialFile, declaredSizeBytes, onProgress, isCancelled)
        } catch (cancelled: MediaImportCancelledException) {
            failOperation(operationId, "cancelled", isCancellation = true)
            partialFile.delete()
            throw cancelled
        } catch (mediaError: MediaImportException) {
            failOperation(operationId, mediaError.reasonCode)
            partialFile.delete()
            throw mediaError
        } catch (error: Exception) {
            failOperation(operationId, MediaImportException.WRITE_FAILED)
            partialFile.delete()
            throw MediaImportException(MediaImportException.WRITE_FAILED, "Could not read or write the selected file")
        }

        val copiedBytes = partialFile.length()
        val finalFile = storage.fileFor(storageKey)
        if (!partialFile.renameTo(finalFile)) {
            failOperation(operationId, MediaImportException.WRITE_FAILED)
            partialFile.delete()
            throw MediaImportException(MediaImportException.WRITE_FAILED, "Could not finalize the replacement file")
        }

        markPhase(operationId, OperationJournalEntity.Phase.MEDIA_PROBING)
        onProgress(ProgressPhase.CHECKING, copiedBytes, copiedBytes)
        val probe = MediaProbe.probe(finalFile, kind)

        onProgress(ProgressPhase.CREATING_PREVIEW, copiedBytes, copiedBytes)
        // Same thumbnail path as before, because the id is the same — the
        // cache file for this asset is simply overwritten with the new art.
        val thumbnailFile = storage.thumbnailFileFor(existing.id)
        val thumbnailPath = if (MediaThumbnailer.generate(finalFile, kind, thumbnailFile)) {
            thumbnailFile.name
        } else {
            thumbnailFile.delete()
            null
        }

        val replaced = existing.copy(
            kind = kind,
            storageKey = storageKey,
            mimeType = MediaKinds.normalize(mimeType),
            sizeBytes = copiedBytes,
            sha256 = sha256,
            durationMs = probe.durationMs,
            widthPx = probe.widthPx,
            heightPx = probe.heightPx,
            integrityState = probe.integrityState,
            updatedAt = Instant.now().toEpochMilli(),
            entityVersion = existing.entityVersion + 1,
            thumbnailPath = thumbnailPath,
        )
        mediaDao.update(replaced)

        // Only now: before this line the record still pointed at the old key.
        storage.fileFor(existing.storageKey).delete()

        markPhase(
            operationId,
            OperationJournalEntity.Phase.COMPLETE,
            resultSummary = JSONObject().apply {
                put("mediaId", replaced.id)
                put("kind", replaced.kind)
                put("replaced", true)
            }.toString(),
        )
        onProgress(ProgressPhase.READY, copiedBytes, copiedBytes)
        NativeLogger.debug("media.replaceSource", mapOf("mediaId" to replaced.id))
        return replaced
    }

    /**
     * An existing managed asset whose bytes these are, or null to import.
     *
     * `MediaDao.getBySha256` has carried the comment "Duplicate detection on
     * import (MR-09 indexes `sha256` for exactly this)" since the DAO was
     * written and had no caller until now, so importing the same photo five
     * times produced five full copies.
     *
     * Three conditions, not just the hash:
     *  - `sizeBytes` must match too. A SHA-256 collision is not a practical
     *    worry, but the pair makes the check total rather than trusting one
     *    signal, and the brief names content hash *and* file size.
     *  - the existing row's file must still exist, or reuse would hand back a
     *    record whose bytes are gone — the missing-media case, not a reuse.
     *  - the row must not be marked `missing`/`unsupported`: reusing an asset
     *    this device already decided it cannot play would propagate that
     *    failure to a reminder the user is creating right now.
     *
     * Returns the oldest match, so repeated imports keep converging on one
     * identity instead of chaining onto whichever copy came last.
     */
    private suspend fun findReusableDuplicate(sha256: String, sizeBytes: Long): MediaAssetEntity? =
        mediaDao.getBySha256(sha256)
            .filter { candidate ->
                candidate.sizeBytes == sizeBytes &&
                    candidate.integrityState != MediaAssetEntity.INTEGRITY_MISSING &&
                    candidate.integrityState != MediaAssetEntity.INTEGRITY_UNSUPPORTED &&
                    storage.fileFor(candidate.storageKey).exists()
            }
            .minByOrNull { it.createdAt }

    /** Streams [sourceUri] into [destination], returning the hex SHA-256 of the bytes written. */
    private suspend fun copyAndHash(
        sourceUri: String,
        destination: File,
        declaredSizeBytes: Long?,
        onProgress: suspend (phase: String, completedBytes: Long?, totalBytes: Long?) -> Unit,
        isCancelled: () -> Boolean,
    ): String {
        val resolver: ContentResolver = context.contentResolver
        val input = resolver.openInputStream(Uri.parse(sourceUri))
            ?: throw MediaImportException(MediaImportException.SOURCE_UNREADABLE, "Could not open the selected file")

        val digest = MessageDigest.getInstance("SHA-256")
        var copiedBytes = 0L
        var bytesSinceLastTick = 0L
        // ~1 MiB between progress events: frequent enough to move a progress
        // bar smoothly, far below a rate that would flood the RN bridge with
        // one event per 64 KB buffer read on a large file (MR-15).
        val progressTickBytes = 16L * MediaStorage.COPY_BUFFER_BYTES

        input.use { stream ->
            destination.outputStream().use { output ->
                val buffer = ByteArray(MediaStorage.COPY_BUFFER_BYTES)
                while (true) {
                    if (isCancelled()) throw MediaImportCancelledException()

                    val read = stream.read(buffer)
                    if (read < 0) break

                    output.write(buffer, 0, read)
                    digest.update(buffer, 0, read)
                    copiedBytes += read
                    bytesSinceLastTick += read

                    // Enforced every iteration, not only against the declared
                    // size: a provider that lies about (or omits) size must
                    // not be able to exceed the hard cap just because nothing
                    // upfront caught it.
                    if (copiedBytes > MediaStorage.MAX_ASSET_BYTES) {
                        throw MediaImportException(
                            MediaImportException.TOO_LARGE,
                            "Actual size exceeded the v1 per-asset limit mid-copy",
                        )
                    }

                    if (bytesSinceLastTick >= progressTickBytes) {
                        onProgress(ProgressPhase.COPYING, copiedBytes, declaredSizeBytes)
                        bytesSinceLastTick = 0
                    }
                }
                // MR-05 step 6 "fsync as appropriate": best-effort durability
                // before the rename below makes this file visible under its
                // final name. Not fatal if the platform/filesystem refuses —
                // the bytes are already correct on disk either way.
                runCatching { output.fd.sync() }
            }
        }
        onProgress(ProgressPhase.COPYING, copiedBytes, declaredSizeBytes ?: copiedBytes)
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    private suspend fun markPhase(operationId: String, phase: String, resultSummary: String? = null) {
        val entry = journalDao.getById(operationId) ?: return
        journalDao.upsert(
            entry.copy(
                phase = phase,
                resultSummary = resultSummary ?: entry.resultSummary,
                updatedAt = Instant.now().toEpochMilli(),
            ),
        )
    }

    private suspend fun failOperation(operationId: String, reasonCode: String, isCancellation: Boolean = false) {
        val entry = journalDao.getById(operationId) ?: return
        journalDao.upsert(
            entry.copy(
                phase = if (isCancellation) {
                    OperationJournalEntity.Phase.CANCELLED
                } else {
                    OperationJournalEntity.Phase.FAILED
                },
                errorCode = reasonCode,
                updatedAt = Instant.now().toEpochMilli(),
            ),
        )
        NativeLogger.debug("media.import.failed", mapOf("operationId" to operationId, "reason" to reasonCode))
    }

    /**
     * MR-08 progress phase keys. Redeclared here rather than referencing
     * [com.aslam.mediareminder.bridge.OperationProgressEmitter]'s constants of
     * the same value on purpose: `media/` is domain logic and must not depend
     * on `bridge/`, the same rule [com.aslam.mediareminder.backup.BackupProgress]'s
     * own doc comment states ("kept free of any RN/bridge type so `backup/`
     * has no dependency on the bridge layer"). The two objects sharing string
     * values is the same kind of cross-language protocol duplication as
     * `MediaAssetEntity.KIND_VIDEO` mirroring TypeScript's `MediaKind` union —
     * inherent to two sides of a wire contract, not the logic duplication the
     * "never duplicate logic" rule is about.
     */
    private object ProgressPhase {
        const val COPYING = "copying"
        const val CHECKING = "checking"
        const val CREATING_PREVIEW = "creating_preview"
        const val READY = "ready"
    }
}
