package com.aslam.mediareminder.data.media

/**
 * Pure arithmetic for [com.aslam.mediareminder.media.MediaThumbnailer], split
 * out the same way [MediaQuerySql]/[MediaKinds]/[MediaRename] are: the part
 * most likely to be subtly wrong (off-by-one sampling, a truncated aspect
 * ratio) gets a JVM unit test, while the actual `Bitmap`/
 * `MediaMetadataRetriever` calls stay untested framework glue, matching
 * [com.aslam.mediareminder.media.MediaProbe]'s own documented reasoning.
 */
object ThumbnailMath {

    /**
     * `BitmapFactory.Options.inSampleSize` for a bounds-only decode: the
     * smallest power-of-two divisor that brings both dimensions at or below
     * [maxDimension], so the real decode never allocates more pixel memory
     * than the thumbnail needs (MR-15). Already-small sources return 1
     * (no downsampling, never upsampling).
     */
    fun sampleSizeFor(width: Int, height: Int, maxDimension: Int): Int {
        var sample = 1
        var w = width
        var h = height
        while (w / 2 >= maxDimension && h / 2 >= maxDimension) {
            w /= 2
            h /= 2
            sample *= 2
        }
        return sample
    }

    /**
     * Target pixel size for the final scaled bitmap, preserving aspect
     * ratio, longest side clamped to [maxDimension]. A source already within
     * bounds is returned unchanged (never upscaled).
     */
    fun scaledDimensions(width: Int, height: Int, maxDimension: Int): Pair<Int, Int> {
        val largestSide = maxOf(width, height)
        if (largestSide <= maxDimension || largestSide <= 0) return width to height
        val scale = maxDimension.toDouble() / largestSide
        val scaledWidth = (width * scale).toInt().coerceAtLeast(1)
        val scaledHeight = (height * scale).toInt().coerceAtLeast(1)
        return scaledWidth to scaledHeight
    }

    /**
     * Frame offset (microseconds) for a video thumbnail: 1 second in, or 10%
     * of the duration for anything shorter than 10 seconds — avoids a
     * frequent black/blank first frame while never landing past a very short
     * clip's end. A non-positive or unknown duration falls back to 0 (the
     * first available frame).
     */
    fun frameTimestampUs(durationMs: Long): Long {
        if (durationMs <= 0) return 0L
        val targetMs = minOf(1_000L, durationMs / 10)
        return targetMs * 1_000
    }
}
