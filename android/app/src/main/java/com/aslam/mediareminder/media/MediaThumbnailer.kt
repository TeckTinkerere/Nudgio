package com.aslam.mediareminder.media

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.media.MediaMetadataRetriever
import android.os.Build
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.aslam.mediareminder.data.media.ThumbnailMath
import com.aslam.mediareminder.diagnostics.NativeLogger
import java.io.File
import java.io.FileOutputStream

/**
 * MR-05 import step 8: "Generate thumbnail as derived cache; thumbnail
 * failure does not invalidate the source asset." Runs after
 * [MediaProbe] against the same finished file, for the same reason
 * (`MediaMetadataRetriever`/`BitmapFactory` need random-access seeking).
 *
 * The thumbnail is real derived content, not a placeholder:
 *  - video -> an actual decoded frame near the start of the clip;
 *  - image -> the source image itself, downscaled;
 *  - audio -> embedded cover art, when the file actually has any;
 *  - text -> no thumbnail (nothing to depict) — [MediaCard]'s existing icon
 *    fallback covers all four of these "no image" cases identically.
 *
 * Never throws: every failure path here is caught, logged at `debug` (this is
 * expected data variability — a truncated video, a codec `BitmapFactory`
 * can't decode — not a code fault, matching [MediaProbe]'s own reasoning),
 * and reported as "no thumbnail" rather than failing the import that already
 * completed successfully one step earlier.
 */
object MediaThumbnailer {
    private const val MAX_DIMENSION_PX = 640
    private const val WEBP_QUALITY = 82

    /**
     * Bounds-only decode (no pixel buffer allocated) — cheap enough to run
     * over every cached thumbnail on a startup sweep. A thumbnail file can
     * exist on disk yet fail to decode (truncated write, a previous OS-level
     * storage fault) without the row's `thumbnail_path` ever being cleared,
     * since nothing previously checked the file's actual readability, only
     * its presence.
     */
    fun isValid(file: File): Boolean {
        if (!file.exists()) return false
        val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        return try {
            BitmapFactory.decodeFile(file.absolutePath, options)
            options.outWidth > 0 && options.outHeight > 0
        } catch (error: Exception) {
            false
        }
    }

    fun generate(sourceFile: File, kind: String, destination: File): Boolean {
        val sourceBitmap = try {
            when (kind) {
                MediaAssetEntity.KIND_VIDEO -> frameFromVideo(sourceFile)
                MediaAssetEntity.KIND_IMAGE -> downscaledImage(sourceFile)
                MediaAssetEntity.KIND_AUDIO -> embeddedArt(sourceFile)
                else -> null
            }
        } catch (error: Exception) {
            NativeLogger.debug(
                "media.thumbnail.failed",
                mapOf("kind" to kind, "reason" to (error.message ?: error.javaClass.simpleName)),
            )
            null
        } ?: return false

        return try {
            writeWebp(sourceBitmap, destination)
            true
        } catch (error: Exception) {
            NativeLogger.debug("media.thumbnail.writeFailed", mapOf("reason" to (error.message ?: error.javaClass.simpleName)))
            destination.delete()
            false
        }
    }

    private fun writeWebp(source: Bitmap, destination: File) {
        val (targetWidth, targetHeight) = ThumbnailMath.scaledDimensions(source.width, source.height, MAX_DIMENSION_PX)
        val scaled = if (targetWidth == source.width && targetHeight == source.height) {
            source
        } else {
            Bitmap.createScaledBitmap(source, targetWidth, targetHeight, true)
        }
        try {
            FileOutputStream(destination).use { out -> scaled.compress(webpFormat(), WEBP_QUALITY, out) }
        } finally {
            if (scaled !== source) scaled.recycle()
            source.recycle()
        }
    }

    private fun frameFromVideo(file: File): Bitmap? {
        val retriever = MediaMetadataRetriever()
        return try {
            retriever.setDataSource(file.absolutePath)
            val durationMs = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            val targetUs = ThumbnailMath.frameTimestampUs(durationMs)
            retriever.getFrameAtTime(targetUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                ?: retriever.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
        } finally {
            // Not `.use {}`: `release()` is the minSdk-26-safe form
            // (`Closeable` only from API 29), same as `MediaProbe`.
            retriever.release()
        }
    }

    private fun downscaledImage(file: File): Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(file.absolutePath, bounds)
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
        val options = BitmapFactory.Options().apply {
            inSampleSize = ThumbnailMath.sampleSizeFor(bounds.outWidth, bounds.outHeight, MAX_DIMENSION_PX)
        }
        return BitmapFactory.decodeFile(file.absolutePath, options)
    }

    private fun embeddedArt(file: File): Bitmap? {
        val retriever = MediaMetadataRetriever()
        return try {
            val art = retriever.apply { setDataSource(file.absolutePath) }.embeddedPicture ?: return null
            BitmapFactory.decodeByteArray(art, 0, art.size)
        } finally {
            retriever.release()
        }
    }

    @Suppress("DEPRECATION")
    private fun webpFormat(): Bitmap.CompressFormat =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Bitmap.CompressFormat.WEBP_LOSSY
        } else {
            // Pre-API-30: the plain `WEBP` enum is deprecated in favor of the
            // LOSSY/LOSSLESS split but still fully functional (lossy, same as
            // the branch above) — this app's minSdk is 26.
            Bitmap.CompressFormat.WEBP
        }
}
