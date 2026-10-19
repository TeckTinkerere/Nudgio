package com.aslam.mediareminder.backup

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream

/** SEC-10 (storage key shape) and SEC-06 (JSON memory budget). */
class BackupRestoreLimitsTest {

    @get:Rule
    val temp = TemporaryFolder()

    @Test
    fun acceptsTheKeysTheAppWrites() {
        listOf("jpg", "png", "webp", "mp4", "m4a", "heic", "txt", "bin").forEach { ext ->
            assertTrue(ext, BackupStorageKey.isValid("9f8e7d6c-5b4a-4321-8fed-cba987654321.$ext"))
        }
    }

    @Test
    fun rejectsKeysThatCouldEscapeOrCollide() {
        listOf(
            "../../databases/app.db",
            "..\\..\\x.jpg",
            "media/9f8e7d6c-5b4a-4321-8fed-cba987654321.jpg",
            "9f8e7d6c-5b4a-4321-8fed-cba987654321.jpg/../x",
            "9f8e7d6c-5b4a-4321-8fed-cba987654321",
            "9f8e7d6c-5b4a-4321-8fed-cba987654321.JPG",
            "9f8e7d6c-5b4a-4321-8fed-cba987654321.jpg\u0000.png",
            "9F8E7D6C-5B4A-4321-8FED-CBA987654321.jpg",
            "short.jpg",
            "",
            "9f8e7d6c-5b4a-4321-8fed-cba987654321.verylongext",
            "9f8e7d6c-5b4a-4321-8fed-cba987654321.jpg\n",
        ).forEach { key ->
            assertFalse("should reject '$key'", BackupStorageKey.isValid(key))
        }
    }

    @Test
    fun requireThrowsWithAStableReasonCode() {
        val error = assertThrows(BackupFormatException::class.java) { BackupStorageKey.require("../x") }
        assertEquals("media_storage_key_invalid", error.reasonCode)
    }

    @Test
    fun budgetIsSharedAcrossEntries() {
        val budget = BackupJsonBudget(totalLimit = 100)
        budget.charge("a.json", 60)
        budget.charge("b.json", 40)
        assertEquals(100L, budget.used)
        val error = assertThrows(BackupFormatException::class.java) { budget.charge("c.json", 1) }
        assertEquals("zip_json_total_exceeded", error.reasonCode)
    }

    private fun zipOf(vararg entries: Pair<String, ByteArray>): ZipFile {
        val file = File(temp.root, "t-${System.nanoTime()}.zip")
        ZipOutputStream(file.outputStream()).use { zip ->
            for ((name, bytes) in entries) {
                zip.putNextEntry(ZipEntry(name))
                zip.write(bytes)
                zip.closeEntry()
            }
        }
        return ZipFile(file)
    }

    private fun declared(name: String, size: Long) =
        mapOf(name to BackupZipStructuralValidator.ValidatedEntry(name, size, size))

    @Test
    fun readsAnEntryWithinTheLimits() {
        val bytes = ByteArray(1000) { 'a'.code.toByte() }
        zipOf("data/x.json" to bytes).use { zip ->
            val budget = BackupJsonBudget()
            val read = BackupSemanticValidator.readEntryBytes(zip, "data/x.json", declared("data/x.json", 1000), budget)
            assertEquals(1000, read.size)
            assertEquals(1000L, budget.used)
        }
    }

    @Test
    fun streamedBytesCountEvenWhenTheDeclaredSizeIsSmall() {
        // The header says 10 bytes; the stream is longer. The budget follows
        // the stream, not the header.
        zipOf("data/x.json" to ByteArray(5_000)).use { zip ->
            val budget = BackupJsonBudget(totalLimit = 1_000)
            val error = assertThrows(BackupFormatException::class.java) {
                BackupSemanticValidator.readEntryBytes(zip, "data/x.json", declared("data/x.json", 10), budget)
            }
            assertEquals("zip_json_total_exceeded", error.reasonCode)
        }
    }

    @Test
    fun aSecondEntryCannotReuseTheFirstEntrysBudget() {
        zipOf("data/a.json" to ByteArray(600), "data/b.json" to ByteArray(600)).use { zip ->
            val budget = BackupJsonBudget(totalLimit = 1_000)
            BackupSemanticValidator.readEntryBytes(zip, "data/a.json", declared("data/a.json", 600), budget)
            val error = assertThrows(BackupFormatException::class.java) {
                BackupSemanticValidator.readEntryBytes(zip, "data/b.json", declared("data/b.json", 600), budget)
            }
            assertEquals("zip_json_total_exceeded", error.reasonCode)
        }
    }

    @Test
    fun anEntryDeclaredOverThePerEntryCapIsRejectedBeforeReading() {
        zipOf("data/x.json" to ByteArray(10)).use { zip ->
            val error = assertThrows(BackupFormatException::class.java) {
                BackupSemanticValidator.readEntryBytes(
                    zip,
                    "data/x.json",
                    declared("data/x.json", BackupFormat.MAX_JSON_ENTRY_BYTES + 1),
                    BackupJsonBudget(),
                )
            }
            assertEquals("zip_entry_too_large", error.reasonCode)
        }
    }
}
