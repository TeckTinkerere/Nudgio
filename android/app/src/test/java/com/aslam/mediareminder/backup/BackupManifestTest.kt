package com.aslam.mediareminder.backup

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

/**
 * JVM unit tests for [BackupManifest] — MR-10 "Manifest schema" round trip
 * and required-field validation. No Android dependency; runs on the plain
 * JVM (needs a real `org.json` implementation on the test classpath — see
 * `testImplementation("org.json:json:...")` in `app/build.gradle`).
 */
class BackupManifestTest {

    private fun sampleManifest() = BackupManifest(
        format = BackupFormat.FORMAT_ID,
        archiveVersion = BackupFormat.ARCHIVE_VERSION,
        createdAt = "2026-01-01T00:00:00Z",
        sourceAppVersion = "0.1.0",
        sourceSchemaVersion = 3,
        minimumReaderArchiveVersion = BackupFormat.MINIMUM_READER_ARCHIVE_VERSION,
        exportId = "11111111-1111-4111-8111-111111111111",
        scope = BackupFormat.SCOPE_ALL,
        includesHistory = false,
        counts = BackupManifest.Counts(mediaAssets = 0, reminders = 2, profiles = 3, categories = 0, tags = 0),
        totalMediaBytes = "0",
        hashAlgorithm = BackupFormat.HASH_ALGORITHM,
        recordsEncoding = BackupFormat.RECORDS_ENCODING,
        privacy = BackupFormat.PRIVACY_LABEL,
    )

    @Test
    fun `toJson then fromJson round-trips every field`() {
        val original = sampleManifest()

        val parsed = BackupManifest.fromJson(original.toJson())

        assertEquals(original, parsed)
    }

    @Test
    fun `majorVersion parses the leading integer`() {
        assertEquals(1, sampleManifest().copy(archiveVersion = "1.0").majorVersion)
        assertEquals(2, sampleManifest().copy(archiveVersion = "2.3").majorVersion)
    }

    @Test
    fun `majorVersion is zero for a malformed version string`() {
        assertEquals(0, sampleManifest().copy(archiveVersion = "not-a-version").majorVersion)
    }

    @Test
    fun `fromJson rejects a wrong format id`() {
        val json = sampleManifest().toJson().apply { put("format", "com.someone.else") }

        val error = assertThrows(BackupFormatException::class.java) { BackupManifest.fromJson(json) }
        assertEquals("manifest_wrong_format", error.reasonCode)
    }

    @Test
    fun `fromJson rejects a missing required field`() {
        val json = sampleManifest().toJson()
        json.remove("exportId")

        val error = assertThrows(BackupFormatException::class.java) { BackupManifest.fromJson(json) }
        assertEquals("manifest_missing_field", error.reasonCode)
    }

    @Test
    fun `fromJson rejects a null required field the same as a missing one`() {
        val json = sampleManifest().toJson()
        json.put("exportId", JSONObject.NULL)

        val error = assertThrows(BackupFormatException::class.java) { BackupManifest.fromJson(json) }
        assertEquals("manifest_missing_field", error.reasonCode)
    }

    @Test
    fun `fromJson rejects a missing counts object`() {
        val json = sampleManifest().toJson()
        json.remove("counts")

        val error = assertThrows(BackupFormatException::class.java) { BackupManifest.fromJson(json) }
        assertEquals("manifest_missing_field", error.reasonCode)
    }

    @Test
    fun `fromJson defaults includesHistory to false when absent`() {
        val json = sampleManifest().toJson()
        json.remove("includesHistory")

        val parsed = BackupManifest.fromJson(json)

        assertEquals(false, parsed.includesHistory)
    }
}
