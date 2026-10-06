package com.aslam.mediareminder.media

import org.junit.Assert.assertEquals
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
        // Mid-size volume: 5% of 16 GB (~819 MB) is above the 250 MB floor
        // and below the 1 GB cap, so the percentage is the binding constraint.
        val total = 16L * oneGb
        val usable = 2L * oneGb
        val incoming = 1_300L * 1024 * 1024 // leaves ~748 MB, under ~819 MB

        assertFalse(MediaStorage.hasRoomFor(incoming, usable, total))
    }

    @Test
    fun `reserve is the greater of the two floors, not their sum`() {
        val total = 16L * oneGb
        val reserve = (total * MediaStorage.MIN_FREE_RESERVE_FRACTION).toLong()
        val usable = 2L * oneGb
        // Leaves exactly the 5% reserve free. A bug that summed both floors
        // instead of taking the max would reject this.
        val incoming = usable - reserve

        assertTrue(MediaStorage.hasRoomFor(incoming, usable, total))
    }

    @Test
    fun `a large phone is not asked to keep gigabytes free`() {
        // DL-109, the reported case: 5% of 256 GB is 12.8 GB, so 8 GB free
        // refused every import. The 5% share is capped at 1 GB.
        val total = 256L * oneGb
        val usable = 8L * oneGb
        val incoming = 2L * oneGb

        assertTrue(MediaStorage.hasRoomFor(incoming, usable, total))
        assertEquals(MediaStorage.MAX_FREE_RESERVE_BYTES, MediaStorage.reserveFor(total))
    }

    @Test
    fun `the cap still keeps a gigabyte free on a large phone`() {
        val total = 256L * oneGb
        val usable = 3L * oneGb
        val incoming = 2L * oneGb + 1 // leaves just under 1 GB

        assertFalse(MediaStorage.hasRoomFor(incoming, usable, total))
    }

    @Test
    fun `an incoming file larger than usable space is always rejected`() {
        assertFalse(MediaStorage.hasRoomFor(incomingBytes = oneGb, usableBytes = 100_000L, totalBytes = oneGb))
    }
}
