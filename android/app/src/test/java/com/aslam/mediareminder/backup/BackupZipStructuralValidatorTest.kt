package com.aslam.mediareminder.backup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * JVM unit tests for [BackupZipStructuralValidator] — MR-10 import phase 2.
 * Builds real ZIP files on disk with [java.util.zip.ZipOutputStream] and
 * feeds them through [BackupZipStructuralValidator.validate]; no Android
 * dependency, runs on the plain JVM.
 */
class BackupZipStructuralValidatorTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private fun zipFile(name: String = "archive.zip", vararg entries: Pair<String, ByteArray>): File {
        val file = tempFolder.newFile(name)
        ZipOutputStream(file.outputStream()).use { out ->
            for ((entryName, bytes) in entries) {
                out.putNextEntry(ZipEntry(entryName))
                out.write(bytes)
                out.closeEntry()
            }
        }
        return file
    }

    private fun minimalValidEntries(vararg extra: Pair<String, ByteArray>): Array<Pair<String, ByteArray>> =
        arrayOf(
            BackupFormat.ENTRY_MANIFEST to "{}".toByteArray(),
            BackupFormat.ENTRY_CHECKSUMS to "abcd  manifest.json\n".toByteArray(),
            *extra,
        )

    private fun rejectionCode(block: () -> Unit): String {
        try {
            block()
            fail("expected a BackupFormatException")
        } catch (error: BackupFormatException) {
            return error.reasonCode
        }
        error("unreachable")
    }

    @Test
    fun `a minimal well-formed archive validates and closes cleanly`() {
        val file = zipFile(entries = minimalValidEntries("data/reminders.json" to "[]".toByteArray()))

        val result = BackupZipStructuralValidator.validate(file)
        try {
            assertEquals(3, result.entries.size)
            assertTrue(result.entries.any { it.name == BackupFormat.ENTRY_MANIFEST })
        } finally {
            result.zipFile.close()
        }
    }

    @Test
    fun `an archive with no entries is rejected`() {
        val file = zipFile()

        assertEquals("zip_empty", rejectionCode { BackupZipStructuralValidator.validate(file) })
    }

    @Test
    fun `a non-zip file is rejected as an invalid signature`() {
        val file = tempFolder.newFile("not-a-zip.bin")
        file.writeBytes(byteArrayOf(1, 2, 3, 4, 5))

        assertEquals("zip_signature_invalid", rejectionCode { BackupZipStructuralValidator.validate(file) })
    }

    @Test
    fun `an absolute-path entry is rejected`() {
        val file = zipFile(entries = minimalValidEntries("/etc/passwd" to "x".toByteArray()))

        assertEquals("zip_entry_absolute_path", rejectionCode { BackupZipStructuralValidator.validate(file) })
    }

    @Test
    fun `a path-traversal entry is rejected`() {
        val file = zipFile(entries = minimalValidEntries("../../evil.json" to "x".toByteArray()))

        assertEquals("zip_entry_traversal", rejectionCode { BackupZipStructuralValidator.validate(file) })
    }

    @Test
    fun `a drive-prefixed entry is rejected`() {
        val file = zipFile(entries = minimalValidEntries("C:evil.json" to "x".toByteArray()))

        assertEquals("zip_entry_drive_prefix", rejectionCode { BackupZipStructuralValidator.validate(file) })
    }

    @Test
    fun `duplicate case-variant entry names are rejected`() {
        val file = zipFile(
            entries = minimalValidEntries(
                "data/reminders.json" to "[]".toByteArray(),
                "DATA/REMINDERS.JSON" to "[]".toByteArray(),
            ),
        )

        assertEquals("zip_duplicate_entry", rejectionCode { BackupZipStructuralValidator.validate(file) })
    }

    @Test
    fun `a missing manifest is rejected`() {
        val file = zipFile(entries = arrayOf(BackupFormat.ENTRY_CHECKSUMS to "abcd  x\n".toByteArray()))

        assertEquals("zip_missing_manifest", rejectionCode { BackupZipStructuralValidator.validate(file) })
    }

    @Test
    fun `a missing checksums file is rejected`() {
        val file = zipFile(entries = arrayOf(BackupFormat.ENTRY_MANIFEST to "{}".toByteArray()))

        assertEquals("zip_missing_checksums", rejectionCode { BackupZipStructuralValidator.validate(file) })
    }

    @Test
    fun `an implausible compression ratio is rejected as a bomb`() {
        // Highly repetitive content compresses far past COMPRESSION_RATIO_REJECT (300x).
        val huge = ByteArray(2_000_000) { 0 }
        val file = zipFile(entries = minimalValidEntries("data/reminders.json" to huge))

        assertEquals("zip_compression_ratio_bomb", rejectionCode { BackupZipStructuralValidator.validate(file) })
    }

    @Test
    fun `more than the maximum entry count is rejected`() {
        val file = tempFolder.newFile("too-many.zip")
        ZipOutputStream(file.outputStream()).use { out ->
            repeat(BackupFormat.MAX_ZIP_ENTRIES + 1) { index ->
                val entry = ZipEntry("data/file-$index.json").apply {
                    method = ZipEntry.STORED
                    size = 0
                    compressedSize = 0
                    crc = CRC32().value
                }
                out.putNextEntry(entry)
                out.closeEntry()
            }
        }

        assertEquals("zip_too_many_entries", rejectionCode { BackupZipStructuralValidator.validate(file) })
    }
}
