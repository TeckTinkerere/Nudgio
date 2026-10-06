package com.aslam.mediareminder.media

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ColorSpace
import android.os.Build
import java.io.File

/**
 * Lossless re-encoding of imported images (DL-110).
 *
 * Only formats that store pixels without lossy compression are candidates:
 * PNG and BMP. Their pixels are re-encoded as lossless WebP, which is
 * typically a quarter to a half smaller for screenshots, graphics and
 * photos saved as PNG. JPEG, HEIC, WebP and GIF are left exactly as picked:
 * they are already compressed, and re-encoding a lossy format either loses
 * quality or grows the file. Video and audio are never touched — every
 * re-encode of those is lossy.
 *
 * "Lossless" is checked, not assumed. The new file is decoded again and
 * compared pixel for pixel with the original; any difference, any image
 * this cannot represent exactly (16-bit-per-channel PNG, a non-sRGB colour
 * profile), or a saving under [MIN_SAVING_FRACTION] keeps the original
 * bytes. PNG text chunks (and BMP headers) are not carried over; they hold
 * no picture data.
 *
 * Pure function of its input files: it never touches the database, so a
 * failure anywhere simply means "keep the original" to the caller.
 */
object LosslessImageCompressor {

    /** `Bitmap.CompressFormat.WEBP_LOSSLESS` arrived in API 30. */
    private const val MIN_SDK = Build.VERSION_CODES.R

    private val CANDIDATE_MIME_TYPES = setOf("image/png", "image/bmp", "image/x-ms-bmp")

    /** Smaller than this and the format change is not worth making. */
    const val MIN_SAVING_FRACTION = 0.10

    /**
     * Two full ARGB_8888 copies are held during verification, so the pixel
     * count is bounded: 16 MP is 64 MB per copy.
     */
    const val MAX_PIXELS = 16L * 1000 * 1000

    fun isCandidate(mimeType: String, sdkInt: Int = Build.VERSION.SDK_INT): Boolean =
        sdkInt >= MIN_SDK && mimeType in CANDIDATE_MIME_TYPES

    /** True when [compressedBytes] is at least [MIN_SAVING_FRACTION] smaller than [originalBytes]. */
    fun isWorthKeeping(originalBytes: Long, compressedBytes: Long): Boolean =
        compressedBytes > 0 && compressedBytes <= originalBytes * (1 - MIN_SAVING_FRACTION)

    /**
     * Writes a verified lossless WebP of [source] to [destination] and
     * returns true, or returns false (with [destination] removed) when the
     * original should be kept.
     */
    fun compress(source: File, mimeType: String, destination: File): Boolean {
        if (!isCandidate(mimeType) || Build.VERSION.SDK_INT < MIN_SDK) return false
        return try {
            val written = encodeVerified(source, destination)
            if (!written) destination.delete()
            written
        } catch (error: Throwable) {
            // OutOfMemoryError included: the guard below is an estimate.
            destination.delete()
            false
        }
    }

    private fun encodeVerified(source: File, destination: File): Boolean {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeFile(source.path, bounds)
        val pixels = bounds.outWidth.toLong() * bounds.outHeight
        if (pixels <= 0 || pixels > MAX_PIXELS) return false
        // Original + decoded copy, with headroom for the encoder itself.
        val runtime = Runtime.getRuntime()
        val available = runtime.maxMemory() - (runtime.totalMemory() - runtime.freeMemory())
        if (available < pixels * 4 * 3) return false

        val original = decodeExact(source) ?: return false
        try {
            if (!isExactlyRepresentable(original)) return false
            destination.outputStream().use { out ->
                if (!original.compress(Bitmap.CompressFormat.WEBP_LOSSLESS, 100, out)) return false
                runCatching { out.fd.sync() }
            }
            if (!isWorthKeeping(source.length(), destination.length())) return false

            val roundTrip = decodeExact(destination) ?: return false
            try {
                return original.sameAs(roundTrip)
            } finally {
                roundTrip.recycle()
            }
        } finally {
            original.recycle()
        }
    }

    /**
     * Unpremultiplied, so semi-transparent pixels keep their exact colour
     * values through the encode instead of being rounded by premultiplying.
     */
    private fun decodeExact(file: File): Bitmap? = BitmapFactory.decodeFile(
        file.path,
        BitmapFactory.Options().apply {
            inPreferredConfig = Bitmap.Config.ARGB_8888
            inPremultiplied = false
            inScaled = false
        },
    )

    /** 8 bits per channel, sRGB: anything else would not survive lossless WebP unchanged. */
    private fun isExactlyRepresentable(bitmap: Bitmap): Boolean {
        if (bitmap.config != Bitmap.Config.ARGB_8888) return false
        val space = bitmap.colorSpace ?: return true
        return space == ColorSpace.get(ColorSpace.Named.SRGB)
    }
}
