package com.aslam.mediareminder.backup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.security.MessageDigest

/**
 * SEC-02 (bounded media copy) and SEC-04 (media must carry a checksum line).
 * `BackupImporter.promoteMediaFiles` itself needs a Context and a real zip;
 * these drive the two rules it delegates to.
 */
class BackupMediaStreamTest {

    private val path = "media/abc.jpg"
    private val digest get() = MessageDigest.getInstance(BackupFormat.HASH_ALGORITHM)

    private fun copy(input: InputStream, declared: Long, out: ByteArrayOutputStream = ByteArrayOutputStream()): Long =
        BackupMediaStream.copyBounded(input, out, digest, declared, path, bufferSize = 1024)

    @Test
    fun copiesExactlyTheDeclaredSize() {
        val data = ByteArray(5_000) { it.toByte() }
        val out = ByteArrayOutputStream()
        assertEquals(5_000L, copy(ByteArrayInputStream(data), declared = 5_000, out = out))
        assertTrue(data.contentEquals(out.toByteArray()))
    }

    @Test
    fun shortStreamIsLeftToTheChecksum() {
        assertEquals(10L, copy(ByteArrayInputStream(ByteArray(10)), declared = 5_000))
    }

    @Test
    fun streamLargerThanDeclaredSizeIsRejected() {
        val error = assertThrows(BackupFormatException::class.java) {
            copy(ByteArrayInputStream(ByteArray(5_001)), declared = 5_000)
        }
        assertEquals("media_entry_oversize", error.reasonCode)
    }

    @Test
    fun oversizedStreamNeverReachesTheOutput() {
        val out = ByteArrayOutputStream()
        assertThrows(BackupFormatException::class.java) {
            copy(ByteArrayInputStream(ByteArray(10_000)), declared = 2_000, out = out)
        }
        // At most the bytes up to the buffer that crossed the cap were written.
        assertTrue("wrote ${out.size()} bytes", out.size() <= 2_000)
    }

    @Test
    fun endlessStreamStopsAtTheDeclaredSizeInsteadOfReadingToEof() {
        var produced = 0L
        val endless = object : InputStream() {
            override fun read(): Int = 0
            override fun read(b: ByteArray, off: Int, len: Int): Int {
                produced += len
                return len
            }
        }
        assertThrows(BackupFormatException::class.java) { copy(endless, declared = 4_096) }
        assertTrue("read $produced bytes", produced <= 4_096 + 1024)
    }

    @Test
    fun globalCapAppliesWhenTheHeaderDeclaresMoreThanIsAllowed() {
        // A header claiming more than MAX_MEDIA_ENTRY_BYTES (or an unknown -1)
        // is clamped, not trusted. 2 GB of zeros is too large to materialise,
        // so assert the clamp through a stream that stops at the cap.
        var produced = 0L
        val endless = object : InputStream() {
            override fun read(): Int = 0
            override fun read(b: ByteArray, off: Int, len: Int): Int {
                produced += len
                return len
            }
        }
        val sink = object : java.io.OutputStream() {
            override fun write(b: Int) {}
            override fun write(b: ByteArray, off: Int, len: Int) {}
        }
        val error = assertThrows(BackupFormatException::class.java) {
            BackupMediaStream.copyBounded(
                endless, sink, digest, declaredSize = Long.MAX_VALUE, path = path, bufferSize = 1 shl 20,
            )
        }
        assertEquals("media_entry_oversize", error.reasonCode)
        assertTrue(produced > BackupFormat.MAX_MEDIA_ENTRY_BYTES)
        assertTrue(produced <= BackupFormat.MAX_MEDIA_ENTRY_BYTES + (1 shl 20))
    }

    @Test
    fun matchingChecksumPasses() {
        BackupMediaStream.requireMatchingChecksum(path, "ABCDEF", "abcdef")
    }

    @Test
    fun mismatchedChecksumIsCorrupt() {
        val error = assertThrows(BackupFormatException::class.java) {
            BackupMediaStream.requireMatchingChecksum(path, "a".repeat(64), "b".repeat(64))
        }
        assertEquals("media_entry_corrupt", error.reasonCode)
    }

    @Test
    fun missingChecksumIsCorruptNotAccepted() {
        val error = assertThrows(BackupFormatException::class.java) {
            BackupMediaStream.requireMatchingChecksum(path, null, "b".repeat(64))
        }
        assertEquals("media_entry_corrupt", error.reasonCode)
    }
}
