package com.aslam.mediareminder.media

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.zip.ZipFile

class ShareZipWriterTest {

    @get:Rule
    val temp = TemporaryFolder()

    private fun file(name: String, bytes: ByteArray) = temp.newFile(name).apply { writeBytes(bytes) }

    @Test
    fun writesEveryEntryUnderItsFolderPathWithTheOriginalBytes() {
        val big = ByteArray(300_000) { (it % 251).toByte() } // spans several copy windows
        val small = "hello".toByteArray()
        val out = File(temp.root, "out.zip")

        val written = ShareZipWriter.write(
            listOf(
                ShareZipWriter.Entry("Holidays/Beach/big.bin", file("big", big), 1_700_000_000_000),
                ShareZipWriter.Entry("note.txt", file("small", small), 1_700_000_100_000),
            ),
            out,
        )

        assertEquals(2, written)
        ZipFile(out).use { zip ->
            assertEquals(setOf("Holidays/Beach/big.bin", "note.txt"), zip.entries().asSequence().map { it.name }.toSet())
            assertArrayEquals(big, zip.getInputStream(zip.getEntry("Holidays/Beach/big.bin")).readBytes())
            assertArrayEquals(small, zip.getInputStream(zip.getEntry("note.txt")).readBytes())
        }
    }

    @Test
    fun doesNotSpendTimeCompressing() {
        // Already-compressed media: level 0 means the entry is about the size
        // of its input, never much smaller.
        val noise = ByteArray(100_000) { (it * 7919 % 256).toByte() }
        val out = File(temp.root, "out.zip")
        ShareZipWriter.write(listOf(ShareZipWriter.Entry("n.bin", file("n", noise), 0)), out)
        ZipFile(out).use { zip ->
            val entry = zip.getEntry("n.bin")
            assertTrue(entry.compressedSize >= noise.size)
        }
    }

    @Test
    fun skipsASourceThatVanishedInsteadOfFailingTheShare() {
        val out = File(temp.root, "out.zip")
        val gone = File(temp.root, "gone.bin")
        val written = ShareZipWriter.write(
            listOf(
                ShareZipWriter.Entry("gone.bin", gone, 0),
                ShareZipWriter.Entry("kept.bin", file("kept", byteArrayOf(1, 2, 3)), 0),
            ),
            out,
        )
        assertEquals(1, written)
        ZipFile(out).use { assertEquals(1, it.size()) }
    }

    @Test
    fun leavesNoZipBehindWhenNothingWasWritten() {
        val out = File(temp.root, "out.zip")
        val written = ShareZipWriter.write(listOf(ShareZipWriter.Entry("x", File(temp.root, "missing"), 0)), out)
        assertEquals(0, written)
        assertFalse(out.exists())
    }

    @Test
    fun deletesThePartialZipWhenAWriteFails() {
        val out = File(temp.root, "out.zip")
        // A directory cannot be read as a file: the stream open throws mid-archive.
        val unreadable = temp.newFolder("dir")
        try {
            ShareZipWriter.write(
                listOf(
                    ShareZipWriter.Entry("ok.bin", file("ok", byteArrayOf(1)), 0),
                    ShareZipWriter.Entry("bad.bin", unreadable, 0),
                ),
                out,
            )
        } catch (expected: Exception) {
            // rethrown after cleanup
        }
        assertFalse(out.exists())
    }
}
