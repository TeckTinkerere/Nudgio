package com.aslam.mediareminder.data.media

import org.junit.Assert.assertEquals
import org.junit.Test

class ThumbnailMathTest {

    @Test
    fun `sampleSizeFor halves while both dimensions comfortably exceed the target`() {
        assertEquals(4, ThumbnailMath.sampleSizeFor(width = 4000, height = 3000, maxDimension = 640))
    }

    @Test
    fun `sampleSizeFor stays at 1 for an already-small image`() {
        assertEquals(1, ThumbnailMath.sampleSizeFor(width = 300, height = 200, maxDimension = 640))
    }

    @Test
    fun `sampleSizeFor stays conservative for an extreme aspect ratio`() {
        // Height alone would fall under the target after one halving, so the
        // loop's AND condition (both dimensions must clear the bar) never
        // fires — the precise final resize (scaledDimensions) does the real
        // work for shapes like this instead of an imprecise pre-sample.
        assertEquals(1, ThumbnailMath.sampleSizeFor(width = 2000, height = 1000, maxDimension = 640))
    }

    @Test
    fun `sampleSizeFor never returns less than 1`() {
        assertEquals(1, ThumbnailMath.sampleSizeFor(width = 100, height = 100, maxDimension = 640))
    }

    @Test
    fun `scaledDimensions clamps the longest side and preserves aspect ratio`() {
        val (width, height) = ThumbnailMath.scaledDimensions(width = 2000, height = 1000, maxDimension = 640)
        assertEquals(640, width)
        assertEquals(320, height)
    }

    @Test
    fun `scaledDimensions never upscales an already-small source`() {
        val (width, height) = ThumbnailMath.scaledDimensions(width = 300, height = 200, maxDimension = 640)
        assertEquals(300, width)
        assertEquals(200, height)
    }

    @Test
    fun `scaledDimensions handles a portrait source`() {
        val (width, height) = ThumbnailMath.scaledDimensions(width = 900, height = 1800, maxDimension = 640)
        assertEquals(320, width)
        assertEquals(640, height)
    }

    @Test
    fun `frameTimestampUs targets one second in for anything 10 seconds or longer`() {
        assertEquals(1_000_000L, ThumbnailMath.frameTimestampUs(durationMs = 20_000))
        assertEquals(1_000_000L, ThumbnailMath.frameTimestampUs(durationMs = 10_000))
    }

    @Test
    fun `frameTimestampUs targets 10 percent in for anything shorter than 10 seconds`() {
        assertEquals(500_000L, ThumbnailMath.frameTimestampUs(durationMs = 5_000))
        assertEquals(200_000L, ThumbnailMath.frameTimestampUs(durationMs = 2_000))
    }

    @Test
    fun `frameTimestampUs falls back to the first frame for an unknown or zero duration`() {
        assertEquals(0L, ThumbnailMath.frameTimestampUs(durationMs = 0))
        assertEquals(0L, ThumbnailMath.frameTimestampUs(durationMs = -1))
    }
}
