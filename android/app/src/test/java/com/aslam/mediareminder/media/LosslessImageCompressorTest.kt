package com.aslam.mediareminder.media

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The decisions around [LosslessImageCompressor]. The encode and pixel
 * comparison need real `Bitmap`s and belong in instrumentation tests; what
 * runs here is which files are ever touched, and when a result is kept.
 */
class LosslessImageCompressorTest {

    private val api30 = 30
    private val api29 = 29

    @Test
    fun `only formats stored without lossy compression are candidates`() {
        assertTrue(LosslessImageCompressor.isCandidate("image/png", api30))
        assertTrue(LosslessImageCompressor.isCandidate("image/bmp", api30))
        assertTrue(LosslessImageCompressor.isCandidate("image/x-ms-bmp", api30))
    }

    @Test
    fun `already compressed formats and all video and audio are left alone`() {
        listOf("image/jpeg", "image/heic", "image/heif", "image/webp", "image/gif", "video/mp4", "audio/mpeg")
            .forEach { assertFalse(it, LosslessImageCompressor.isCandidate(it, api30)) }
    }

    @Test
    fun `nothing is compressed before lossless WebP exists`() {
        assertFalse(LosslessImageCompressor.isCandidate("image/png", api29))
    }

    @Test
    fun `a result is kept only when it saves at least ten percent`() {
        assertTrue(LosslessImageCompressor.isWorthKeeping(originalBytes = 1_000_000, compressedBytes = 900_000))
        assertTrue(LosslessImageCompressor.isWorthKeeping(originalBytes = 1_000_000, compressedBytes = 400_000))
        assertFalse(LosslessImageCompressor.isWorthKeeping(originalBytes = 1_000_000, compressedBytes = 900_001))
        assertFalse(LosslessImageCompressor.isWorthKeeping(originalBytes = 1_000_000, compressedBytes = 1_200_000))
    }

    @Test
    fun `an empty encode is never kept`() {
        assertFalse(LosslessImageCompressor.isWorthKeeping(originalBytes = 1_000_000, compressedBytes = 0))
    }
}
