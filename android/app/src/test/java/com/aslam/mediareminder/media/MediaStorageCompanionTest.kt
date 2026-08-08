package com.aslam.mediareminder.media

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * [MediaStorage.hasRoomFor] is the only piece of `MediaStorage` that runs
 * without a real `Context`/filesystem, so it is the only piece covered here —
 * everything else (`mediaDir`, `newStorageKey`, `sweepPartials`) needs a real
 * `Context.filesDir` and belongs in the instrumentation-test backlog
 * (TODO.md).
 */
class MediaStorageCompanionTest {

    private val oneGb = 1024L * 1024 * 1024
    private val absoluteReserve = MediaStorage.MIN_FREE_RESERVE_BYTES

    @Test
    fun `rejects when remaining space would fall below the absolute reserve`() {
        // Small volume: 5% of total is far below the 250 MB floor, so the
        // floor itself is the binding constraint.
        val total = oneGb
        val usable = absoluteReserve + 10_000 // just over the floor before the file lands
        val incoming = 20_000L // pushes remaining space under the floor

        assertFalse(MediaStorage.hasRoomFor(incoming, usable, total))
    }

    @Test
    fun `accepts when remaining space clears the absolute reserve`() {
        val total = oneGb
        val usable = absoluteReserve + 10_000_000
        val incoming = 1_000_000L

        assertTrue(MediaStorage.hasRoomFor(incoming, usable, total))
    }

    @Test
    fun `rejects when remaining space would fall below the 5 percent-of-total reserve`() {
        // Large volume: 5% of total (500 GB) dwarfs the 250 MB floor, so the
        // percentage is the binding constraint here, not the absolute floor.
        val total = 500L * oneGb // 5% = 25 GB
        val usable = 26L * oneGb
        val incoming = 2L * oneGb // leaves ~24 GB free, under the 25 GB requirement

        assertFalse(MediaStorage.hasRoomFor(incoming, usable, total))
    }

    @Test
    fun `reserve is the greater of the two floors, not their sum`() {
        val total = 500L * oneGb // 5% = 25 GB
        val usable = 26L * oneGb
        // Leaves exactly 25 GB free — satisfies the percentage floor exactly,
        // and 25 GB is already far above the 250 MB absolute floor, so this
        // must pass. A bug that summed both reserves instead of taking the
        // max would reject this.
        val incoming = 1L * oneGb

        assertTrue(MediaStorage.hasRoomFor(incoming, usable, total))
    }

    @Test
    fun `an incoming file larger than usable space is always rejected`() {
        assertFalse(MediaStorage.hasRoomFor(incomingBytes = oneGb, usableBytes = 100_000L, totalBytes = oneGb))
    }
}
