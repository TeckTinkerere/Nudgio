package com.aslam.mediareminder.backup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.ByteArrayInputStream

/**
 * JVM unit tests for [BackupChecksums] — MR-10 "Checksums": the
 * `checksums.sha256` line format and its round trip. No Android dependency;
 * runs on the plain JVM.
 */
class BackupChecksumsTest {

    @Test
    fun `sha256Hex matches a known vector`() {
        // SHA-256("") — the well-known empty-input hash.
        assertEquals(
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            BackupChecksums.sha256Hex(ByteArray(0)),
        )
    }

    @Test
    fun `sha256HexStreaming matches sha256Hex for the same bytes`() {
        val bytes = "the quick brown fox".toByteArray(Charsets.UTF_8)
        assertEquals(BackupChecksums.sha256Hex(bytes), BackupChecksums.sha256HexStreaming(ByteArrayInputStream(bytes)))
    }

    @Test
    fun `formatLine uses a two-space separator matching sha256sum output`() {
        assertEquals("abc123  data/reminders.json\n", BackupChecksums.formatLine("abc123", "data/reminders.json"))
    }

    @Test
    fun `buildChecksumFile sorts entries by path`() {
        val entries = listOf("b.json" to "hash-b", "a.json" to "hash-a")
        val text = String(BackupChecksums.buildChecksumFile(entries), Charsets.UTF_8)

        assertEquals("hash-a  a.json\nhash-b  b.json\n", text)
    }

    @Test
    fun `parseChecksumFile round-trips buildChecksumFile`() {
        val entries = listOf("manifest.json" to "aaaa", "data/reminders.json" to "bbbb")
        val bytes = BackupChecksums.buildChecksumFile(entries)

        val parsed = BackupChecksums.parseChecksumFile(bytes)

        assertEquals("aaaa", parsed["manifest.json"])
        assertEquals("bbbb", parsed["data/reminders.json"])
    }

    @Test
    fun `parseChecksumFile lowercases hashes`() {
        val parsed = BackupChecksums.parseChecksumFile("ABCDEF  manifest.json\n".toByteArray(Charsets.UTF_8))

        assertEquals("abcdef", parsed["manifest.json"])
    }

    @Test
    fun `parseChecksumFile ignores blank and malformed lines`() {
        val bytes = "\n   \nnotavalidline\nabcd  manifest.json\n".toByteArray(Charsets.UTF_8)

        val parsed = BackupChecksums.parseChecksumFile(bytes)

        assertEquals(1, parsed.size)
        assertEquals("abcd", parsed["manifest.json"])
    }

    @Test
    fun `parseChecksumFile tolerates trailing carriage returns`() {
        val parsed = BackupChecksums.parseChecksumFile("abcd  manifest.json\r\n".toByteArray(Charsets.UTF_8))

        assertTrue(parsed.containsKey("manifest.json"))
    }
}
