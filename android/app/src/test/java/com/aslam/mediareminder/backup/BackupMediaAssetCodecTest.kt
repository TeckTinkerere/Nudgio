package com.aslam.mediareminder.backup

import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test

/**
 * [BackupMediaAssetCodec] is the record half of carrying media in an archive;
 * the bytes half is `BackupExporter.writeStoredFileEntry` /
 * `BackupImporter.promoteMediaFiles`, which need a real zip and filesystem.
 */
class BackupMediaAssetCodecTest {

    private fun asset(
        id: String = "a1",
        storageKey: String = "9f8e.jpg",
        notes: String? = "a note",
        durationMs: Long? = 8_000,
    ) = MediaAssetEntity(
        id = id,
        kind = MediaAssetEntity.KIND_IMAGE,
        title = "Morning Motivation",
        notes = notes,
        storageKey = storageKey,
        mimeType = "image/jpeg",
        sizeBytes = 124_119,
        sha256 = "a".repeat(64),
        durationMs = durationMs,
        widthPx = 1080,
        heightPx = 1920,
        categoryId = null,
        integrityState = MediaAssetEntity.INTEGRITY_HEALTHY,
        createdAt = 1_700_000_000_000,
        updatedAt = 1_700_000_100_000,
        entityVersion = 7,
        thumbnailPath = "a1.webp",
    )

    @Test
    fun `survives a round trip with the fields a reminder depends on`() {
        val restored = BackupMediaAssetCodec.fromJson(BackupMediaAssetCodec.toJson(asset()))

        assertEquals("a1", restored.id)
        assertEquals("9f8e.jpg", restored.storageKey)
        assertEquals("Morning Motivation", restored.title)
        assertEquals("a note", restored.notes)
        assertEquals("image/jpeg", restored.mimeType)
        assertEquals(124_119L, restored.sizeBytes)
        assertEquals("a".repeat(64), restored.sha256)
        assertEquals(8_000L, restored.durationMs)
        assertEquals(1080, restored.widthPx)
        assertEquals(1_700_000_000_000, restored.createdAt)
    }

    @Test
    fun `size survives past the range a JSON number would keep exactly`() {
        // Carried as a decimal string for the same reason every other byte
        // count in this app is: a 2 GB asset is fine, but the contract should
        // not depend on the reader's number type.
        val big = asset().copy(sizeBytes = 2L * 1024 * 1024 * 1024)
        val restored = BackupMediaAssetCodec.fromJson(BackupMediaAssetCodec.toJson(big))
        assertEquals(2L * 1024 * 1024 * 1024, restored.sizeBytes)
    }

    @Test
    fun `nulls stay null rather than becoming the string null`() {
        val restored = BackupMediaAssetCodec.fromJson(
            BackupMediaAssetCodec.toJson(asset(notes = null, durationMs = null)),
        )
        assertNull(restored.notes)
        assertNull(restored.durationMs)
    }

    @Test
    fun `local-only state is never trusted from the archive`() {
        val restored = BackupMediaAssetCodec.fromJson(BackupMediaAssetCodec.toJson(asset()))

        // `healthy` on the exporting phone proves nothing about whether the
        // bytes survived the trip — the integrity sweep decides here.
        assertEquals(MediaAssetEntity.INTEGRITY_UNCHECKED, restored.integrityState)
        // Derived cache in `cacheDir`, rebuilt free by the thumbnail backfill.
        assertNull(restored.thumbnailPath)
        // Optimistic-concurrency state is local; a restored row starts fresh.
        assertEquals(1, restored.entityVersion)
    }

    @Test
    fun `a storage key that would escape the media folder is rejected`() {
        // The key becomes a filename on this device, and an archive is
        // attacker-controlled input.
        for (hostile in listOf("../../databases/app.db", "a/b.jpg", ".hidden", "")) {
            val json = BackupMediaAssetCodec.toJson(asset()).put("storageKey", hostile)
            assertThrows(BackupFormatException::class.java) {
                BackupMediaAssetCodec.fromJson(json)
            }
        }
    }

    @Test
    fun `an unknown kind is rejected rather than restored as a broken row`() {
        val json = BackupMediaAssetCodec.toJson(asset()).put("kind", "hologram")
        assertThrows(BackupFormatException::class.java) { BackupMediaAssetCodec.fromJson(json) }
    }

    @Test
    fun `a missing required field is reported as a malformed record`() {
        val json = BackupMediaAssetCodec.toJson(asset())
        json.remove("sha256")
        assertThrows(BackupFormatException::class.java) { BackupMediaAssetCodec.fromJson(json) }
    }
}
