package com.aslam.mediareminder.media

import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.MediaStore
import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.LibraryFolderEntity
import com.aslam.mediareminder.data.db.entity.LibraryMembershipEntity
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.UUID
import java.util.zip.ZipInputStream

/**
 * Library Share and Save to gallery on a real Android runtime: Room, the
 * FileProvider and MediaStore, which a JVM unit test cannot exercise.
 *
 * Everything it writes to the device's gallery carries [PREFIX] in its name
 * and is removed afterwards.
 */
@RunWith(AndroidJUnit4::class)
class LibrarySelectionActionsInstrumentedTest {

    private lateinit var context: Context
    private lateinit var database: MediaReminderDatabase
    private lateinit var storage: MediaStorage
    private lateinit var actions: LibrarySelectionActions
    private val createdFiles = mutableListOf<java.io.File>()

    @Before
    fun setUp() {
        context = InstrumentationRegistry.getInstrumentation().targetContext
        database = Room.inMemoryDatabaseBuilder(context, MediaReminderDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        storage = MediaStorage(context)
        actions = LibrarySelectionActions(context, database, storage)
        cleanGallery()
    }

    @After
    fun tearDown() {
        cleanGallery()
        createdFiles.forEach { it.delete() }
        actions.sweepShareZips()
        database.close()
    }

    private fun image(label: String, bytes: ByteArray): MediaAssetEntity {
        val key = "${UUID.randomUUID()}.jpg"
        storage.fileFor(key).also {
            it.writeBytes(bytes)
            createdFiles += it
        }
        return MediaAssetEntity(
            id = UUID.randomUUID().toString(),
            kind = MediaAssetEntity.KIND_IMAGE,
            title = "$PREFIX$label",
            notes = null,
            storageKey = key,
            mimeType = "image/jpeg",
            sizeBytes = bytes.size.toLong(),
            sha256 = "a".repeat(64),
            durationMs = null,
            widthPx = 1,
            heightPx = 1,
            categoryId = null,
            integrityState = MediaAssetEntity.INTEGRITY_HEALTHY,
            createdAt = 1_700_000_000_000,
            updatedAt = 1_700_000_000_000,
            entityVersion = 1,
            thumbnailPath = null,
        )
    }

    private fun bytes(seed: Int, size: Int) = ByteArray(size) { ((it * 31 + seed) % 251).toByte() }

    private fun readUri(uri: Uri): ByteArray = context.contentResolver.openInputStream(uri)!!.use { it.readBytes() }

    private fun streamOf(intent: Intent): Uri =
        @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_STREAM)!!

    private fun cleanGallery() {
        listOf(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            MediaStore.Video.Media.EXTERNAL_CONTENT_URI,
            MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
        ).forEach { collection ->
            runCatching {
                context.contentResolver.delete(
                    collection,
                    "${MediaStore.MediaColumns.DISPLAY_NAME} LIKE ?",
                    arrayOf("$PREFIX%"),
                )
            }
        }
    }

    private data class GalleryRow(val relativePath: String, val name: String, val size: Long, val bytes: ByteArray)

    private fun galleryRows(): List<GalleryRow> {
        val rows = mutableListOf<GalleryRow>()
        context.contentResolver.query(
            MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
            arrayOf(
                MediaStore.MediaColumns._ID,
                MediaStore.MediaColumns.RELATIVE_PATH,
                MediaStore.MediaColumns.DISPLAY_NAME,
                MediaStore.MediaColumns.SIZE,
            ),
            "${MediaStore.MediaColumns.DISPLAY_NAME} LIKE ?",
            arrayOf("$PREFIX%"),
            null,
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cursor.getLong(0))
                rows += GalleryRow(cursor.getString(1), cursor.getString(2), cursor.getLong(3), readUri(uri))
            }
        }
        return rows
    }

    @Test
    fun oneFileIsSharedAsIsThroughTheFileProvider() = runBlocking {
        val photo = image("solo", bytes(1, 5_000))
        database.mediaDao().insert(photo)

        val outcome = actions.buildShare(listOf(photo.id), emptyList()) as LibrarySelectionActions.ShareOutcome.Ready

        assertEquals(Intent.ACTION_SEND, outcome.intent.action)
        assertEquals("image/jpeg", outcome.intent.type)
        assertEquals(1, outcome.fileCount)
        assertArrayEquals(bytes(1, 5_000), readUri(streamOf(outcome.intent)))
    }

    @Test
    fun severalFilesAndAFolderBecomeOneZipThatKeepsTheStructure() = runBlocking {
        val a = image("a", bytes(2, 70_000)) // more than one copy window
        val b = image("b", bytes(3, 1_000))
        val loose = image("loose", bytes(4, 2_000))
        listOf(a, b, loose).forEach { database.mediaDao().insert(it) }
        database.libraryDao().insert(LibraryFolderEntity("f-holidays", null, "Holidays"))
        database.libraryDao().insert(LibraryFolderEntity("f-beach", "f-holidays", "Beach"))
        database.libraryDao().assign(LibraryMembershipEntity(a.id, "f-holidays"))
        database.libraryDao().assign(LibraryMembershipEntity(b.id, "f-beach"))

        val outcome = actions.buildShare(listOf(loose.id), listOf("f-holidays")) as LibrarySelectionActions.ShareOutcome.Ready

        assertEquals("application/zip", outcome.intent.type)
        assertEquals(3, outcome.fileCount)
        val entries = HashMap<String, ByteArray>()
        ZipInputStream(context.contentResolver.openInputStream(streamOf(outcome.intent))!!).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                entries[entry.name] = zip.readBytes()
            }
        }
        assertEquals(
            setOf("Holidays/${a.title}.jpg", "Holidays/Beach/${b.title}.jpg", "${loose.title}.jpg"),
            entries.keys,
        )
        assertArrayEquals(bytes(2, 70_000), entries.getValue("Holidays/${a.title}.jpg"))
        assertArrayEquals(bytes(3, 1_000), entries.getValue("Holidays/Beach/${b.title}.jpg"))
    }

    @Test
    fun onlyTheNewestShareZipIsKept() = runBlocking {
        val a = image("a", bytes(5, 100))
        val b = image("b", bytes(6, 100))
        database.mediaDao().insert(a)
        database.mediaDao().insert(b)

        actions.buildShare(listOf(a.id, b.id), emptyList())
        Thread.sleep(1_100) // zip names carry a one-second timestamp
        actions.buildShare(listOf(a.id, b.id), emptyList())

        assertEquals(1, java.io.File(context.cacheDir, "share").listFiles()!!.size)
    }

    @Test
    fun nothingExistingMeansNothingToShare() = runBlocking {
        assertTrue(actions.buildShare(listOf("missing"), emptyList()) is LibrarySelectionActions.ShareOutcome.NothingToShare)
    }

    @Test
    fun saveToGalleryPutsFoldersUnderTheNudgioAlbumAndSkipsRepeats() = runBlocking {
        assumeTrue("needs API 29+", MediaStoreExporter.isSupported())
        val a = image("a", bytes(7, 3_000))
        val loose = image("loose", bytes(8, 4_000))
        database.mediaDao().insert(a)
        database.mediaDao().insert(loose)
        database.libraryDao().insert(LibraryFolderEntity("f-trip", null, "Trip"))
        database.libraryDao().assign(LibraryMembershipEntity(a.id, "f-trip"))

        val first = actions.saveToGallery(listOf(loose.id), listOf("f-trip"))

        assertEquals(2, first.saved)
        assertEquals(0, first.failed)
        assertTrue(first.platformSupported)
        val rows = galleryRows().sortedBy { it.relativePath }
        assertEquals(2, rows.size)
        // Loose media in the Nudgio album itself, a folder as a sub-folder of it.
        assertTrue(rows[0].relativePath.endsWith("Pictures/Nudgio/"))
        assertTrue(rows[1].relativePath.endsWith("Pictures/Nudgio/Trip/"))
        assertArrayEquals(bytes(8, 4_000), rows[0].bytes)
        assertArrayEquals(bytes(7, 3_000), rows[1].bytes)

        val second = actions.saveToGallery(listOf(loose.id), listOf("f-trip"))

        assertEquals(0, second.saved)
        assertEquals(2, second.alreadySaved)
        assertEquals(2, galleryRows().size)
        assertNotNull(rows.firstOrNull())
    }

    private companion object {
        const val PREFIX = "NudgioTest-"
    }
}
