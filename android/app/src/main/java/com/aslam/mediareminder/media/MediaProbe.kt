package com.aslam.mediareminder.media

import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.aslam.mediareminder.diagnostics.NativeLogger
import java.io.File

/**
 * MR-05 "Import transaction" step 5: "Probe media and extract safe metadata."
 *
 * Runs *after* the file has already been fully copied and hashed
 * ([MediaImporter]), against the final on-disk file rather than the source
 * stream — `MediaMetadataRetriever`/`BitmapFactory` both need random-access
 * seeking a `ContentResolver` stream does not reliably support, and probing
 * the copy means a source that disappears mid-import (permission revoked,
 * file deleted) cannot leave a half-probed row.
 *
 * A probe failure is not an import failure: MR-05's table lists
 * [MediaAssetEntity.INTEGRITY_UNSUPPORTED] as a real outcome, not an error —
 * the row is still created so the user sees *what* they imported and why it
 * will not play, per MR-11's "explain, don't silently drop" principle. Only
 * bytes-couldn't-be-read is a hard failure, and that already happened earlier
 * in the copy step, before this probe ever runs.
 *
 * Not unit-testable on the plain JVM: `MediaMetadataRetriever` and
 * `BitmapFactory` are both real Android framework classes with native
 * backing, not `Stub!` classes robolectric-free JVM tests can exercise
 * meaningfully. Covered by TODO.md's instrumentation-test backlog instead.
 */
object MediaProbe {

    data class Result(
        val durationMs: Long?,
        val widthPx: Int?,
        val heightPx: Int?,
        val integrityState: String,
    )

    fun probe(file: File, kind: String): Result = when (kind) {
        MediaAssetEntity.KIND_VIDEO -> probeWithRetriever(file, wantDimensions = true)
        MediaAssetEntity.KIND_AUDIO -> probeWithRetriever(file, wantDimensions = false)
        MediaAssetEntity.KIND_IMAGE -> probeImage(file)
        MediaAssetEntity.KIND_TEXT ->
            // The copy step already proved every byte is readable; MR-05's
            // text validation ("UTF-8 length and safe rendering") is a
            // display-time concern for the text-card viewer, not an import
            // gate; deferred with text cards themselves (TODO.md).
            Result(durationMs = null, widthPx = null, heightPx = null, integrityState = MediaAssetEntity.INTEGRITY_HEALTHY)
        else -> Result(durationMs = null, widthPx = null, heightPx = null, integrityState = MediaAssetEntity.INTEGRITY_UNSUPPORTED)
    }

    private fun probeWithRetriever(file: File, wantDimensions: Boolean): Result {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(file.absolutePath)
            val durationMs = retriever
                .extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                ?.toLongOrNull()
            val widthPx = if (wantDimensions) {
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull()
            } else {
                null
            }
            val heightPx = if (wantDimensions) {
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull()
            } else {
                null
            }
            Result(durationMs, widthPx, heightPx, MediaAssetEntity.INTEGRITY_HEALTHY)
        } catch (error: Exception) {
            // `setDataSource` throws `RuntimeException` (often
            // `IllegalArgumentException`) for an unsupported/corrupt
            // container — exactly what `INTEGRITY_UNSUPPORTED` exists for.
            // `debug`, not `warn`/`error`: an unsupported file is expected
            // data variability, not a code fault, and MR-07 keeps
            // every-variant logs (`warn`/`error`) for actual bugs.
            NativeLogger.debug("media.probe.unsupported", mapOf("reason" to (error.message ?: error.javaClass.simpleName)))
            Result(durationMs = null, widthPx = null, heightPx = null, integrityState = MediaAssetEntity.INTEGRITY_UNSUPPORTED)
        } finally {
            // Not `.use {}`: `MediaMetadataRetriever` only implements
            // `Closeable` from API 29; `release()` is the minSdk-26-safe form.
            retriever.release()
        }
    }

    private fun probeImage(file: File): Result {
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        // Bounds-only decode never allocates pixel memory (MR-15): this reads
        // just the header, regardless of the image's actual resolution.
        BitmapFactory.decodeFile(file.absolutePath, options)
        return if (options.outWidth > 0 && options.outHeight > 0) {
            Result(durationMs = null, widthPx = options.outWidth, heightPx = options.outHeight, integrityState = MediaAssetEntity.INTEGRITY_HEALTHY)
        } else {
            Result(durationMs = null, widthPx = null, heightPx = null, integrityState = MediaAssetEntity.INTEGRITY_UNSUPPORTED)
        }
    }
}
