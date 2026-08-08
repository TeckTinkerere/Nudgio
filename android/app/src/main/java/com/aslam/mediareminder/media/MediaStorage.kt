package com.aslam.mediareminder.media

import android.content.Context
import com.aslam.mediareminder.data.media.MediaKinds
import java.io.File
import java.util.UUID

/**
 * Owns the app-private media directory (ADR-010, MR-09 "File storage").
 *
 * Every imported byte lives under `filesDir/media/` with an opaque
 * `<uuid>.<ext>` name. MR-09: "No user-supplied path segment enters the file
 * path" — the provider's display name becomes the *title* column and never
 * touches the filesystem, so a hostile or merely awkward name (`../../x`, a
 * 4 KB name, a reserved device name) cannot escape the directory or collide.
 */
class MediaStorage(private val context: Context) {

    /** Created lazily on first use; `mkdirs` is idempotent. */
    fun mediaDir(): File = File(context.filesDir, MEDIA_DIR_NAME).apply { mkdirs() }

    fun newStorageKey(mimeType: String?): String =
        "${UUID.randomUUID()}.${MediaKinds.extensionFor(mimeType)}"

    fun fileFor(storageKey: String): File = File(mediaDir(), storageKey)

    /**
     * MR-09 "File storage": "Derived thumbnails are WebP cache and may be
     * cleared at any time" — `cacheDir`, not `filesDir`, so the OS is free to
     * reclaim it under storage pressure without touching a real asset.
     * Created lazily; `mkdirs` is idempotent.
     */
    fun thumbnailsDir(): File = File(context.cacheDir, THUMBNAILS_DIR_NAME).apply { mkdirs() }

    /** Opaque `<uuid>.webp` name, same "no user-supplied segment" rule as [newStorageKey]. */
    fun thumbnailFileFor(mediaId: String): File = File(thumbnailsDir(), "$mediaId.webp")

    /**
     * Partial-download file used while copying.
     *
     * Copying to `<key>.part` and renaming on success means a crash mid-copy
     * leaves a file the `.part` suffix marks as junk, never a truncated file at
     * the real storage key that a later row could point at. [sweepPartials]
     * removes them; the rename itself is atomic within one filesystem.
     */
    fun partialFor(storageKey: String): File = File(mediaDir(), "$storageKey$PARTIAL_SUFFIX")

    /**
     * Deletes leftover `.part` files from interrupted imports.
     *
     * Safe to run at any time: a `.part` file is only ever referenced by the
     * single in-flight copy that created it, and no database row can point at
     * one, because the row is inserted after the rename.
     */
    fun sweepPartials(): Int {
        val partials = mediaDir().listFiles { file -> file.name.endsWith(PARTIAL_SUFFIX) }
            ?: return 0
        return partials.count { it.delete() }
    }

    /** Free space on the volume holding the media directory, for the MR-09 reserve check. */
    fun usableSpaceBytes(): Long = mediaDir().usableSpace

    companion object {
        private const val MEDIA_DIR_NAME = "media"
        private const val THUMBNAILS_DIR_NAME = "thumbnails"
        private const val PARTIAL_SUFFIX = ".part"

        /** MR-09 "Storage limits": individual asset hard limit for v1. */
        const val MAX_ASSET_BYTES = 2L * 1024 * 1024 * 1024

        /** MR-09: maintain 250 MB or 5% free-storage reserve, whichever is greater. */
        const val MIN_FREE_RESERVE_BYTES = 250L * 1024 * 1024
        const val MIN_FREE_RESERVE_FRACTION = 0.05

        /**
         * Streaming buffer. 64 KB keeps peak memory flat regardless of asset
         * size — MR-15 budgets import memory independently of the file, so the
         * copy must never read the whole thing (a 2 GB asset would OOM).
         */
        const val COPY_BUFFER_BYTES = 64 * 1024

        /**
         * Reserve required before starting a copy of [incomingBytes].
         *
         * Pure so the rule is unit-testable: the reserve is the greater of the
         * absolute floor and 5% of the volume, and it must remain free *after*
         * the incoming file is written.
         */
        fun hasRoomFor(incomingBytes: Long, usableBytes: Long, totalBytes: Long): Boolean {
            val reserve = maxOf(
                MIN_FREE_RESERVE_BYTES,
                (totalBytes * MIN_FREE_RESERVE_FRACTION).toLong(),
            )
            return usableBytes - incomingBytes >= reserve
        }
    }
}
