package com.aslam.mediareminder.media

import com.aslam.mediareminder.data.db.entity.LibraryFolderEntity
import com.aslam.mediareminder.data.db.entity.LibraryMembershipEntity
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SelectionPlannerTest {

    private fun asset(id: String, title: String = id, ext: String = "jpg") = MediaAssetEntity(
        id = id,
        kind = MediaAssetEntity.KIND_IMAGE,
        title = title,
        notes = null,
        storageKey = "$id-0000-0000-0000-000000000000.$ext",
        mimeType = "image/jpeg",
        sizeBytes = 10,
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

    private fun folder(id: String, name: String, parent: String? = null) = LibraryFolderEntity(id, parent, name)
    private fun home(media: String, folder: String) = LibraryMembershipEntity(media, folder)

    private val holidays = folder("f-holidays", "Holidays")
    private val beach = folder("f-beach", "Beach", parent = "f-holidays")
    private val work = folder("f-work", "Work")
    private val folders = listOf(holidays, beach, work)

    private val a = asset("a")
    private val b = asset("b")
    private val c = asset("c")
    private val d = asset("d")
    private val loose = asset("loose")
    private val assets = listOf(a, b, c, d, loose)
    private val memberships = listOf(home("a", "f-holidays"), home("b", "f-beach"), home("c", "f-work"))
    // d and loose are filed nowhere.

    private fun plan(media: List<String> = emptyList(), vararg folderIds: String) =
        SelectionPlanner.plan(media, folderIds.toList(), folders, memberships, assets)

    private fun paths(planned: List<PlannedFile>) = planned.associate { it.asset.id to it.folderPath }

    @Test
    fun aFolderBringsItsSubfoldersAndKeepsTheStructure() {
        assertEquals(
            mapOf("a" to listOf("Holidays"), "b" to listOf("Holidays", "Beach")),
            paths(plan(emptyList(), "f-holidays")),
        )
    }

    @Test
    fun aSubfolderChosenAloneIsItsOwnRoot() {
        assertEquals(mapOf("b" to listOf("Beach")), paths(plan(emptyList(), "f-beach")))
    }

    @Test
    fun aFolderAndItsSubfolderTogetherListEverythingOnce() {
        val planned = plan(emptyList(), "f-beach", "f-holidays")
        assertEquals(2, planned.size)
        assertEquals(listOf("Holidays", "Beach"), paths(planned).getValue("b"))
    }

    @Test
    fun looseMediaSitsAtTheTopEvenIfItIsFiledInAFolder() {
        assertEquals(mapOf("c" to emptyList<String>(), "loose" to emptyList()), paths(plan(listOf("c", "loose"))))
    }

    @Test
    fun aFileChosenBothWaysAppearsOnceInsideItsFolder() {
        val planned = plan(listOf("a"), "f-holidays")
        assertEquals(2, planned.size)
        assertEquals(listOf("Holidays"), paths(planned).getValue("a"))
    }

    @Test
    fun theUnsortedAlbumIsEverythingFiledNowhere() {
        assertEquals(
            mapOf("d" to listOf("Unsorted"), "loose" to listOf("Unsorted")),
            paths(plan(emptyList(), SelectionPlanner.UNSORTED_ID)),
        )
    }

    @Test
    fun unknownIdsAreIgnored() {
        assertTrue(plan(listOf("nope"), "f-nope").isEmpty())
    }

    @Test
    fun anEmptyFolderContributesNothing() {
        val empty = SelectionPlanner.plan(emptyList(), listOf("f-empty"), folders + folder("f-empty", "Empty"), memberships, assets)
        assertTrue(empty.isEmpty())
    }

    @Test
    fun filesWithTheSameTitleGetDistinctNamesInTheSameFolder() {
        val first = asset("x1", title = "Photo")
        val second = asset("x2", title = "photo") // differs only by case
        val third = asset("x3", title = "Photo", ext = "png")
        val named = SelectionPlanner.nameFiles(
            listOf(first, second, third).map { PlannedFile(it, listOf("Trip")) },
        )
        assertEquals(listOf("Photo.jpg", "photo (1).jpg", "Photo.png"), named.map { it.fileName })
        assertEquals(3, named.map { it.path.lowercase() }.toSet().size)
    }

    @Test
    fun theSameTitleInDifferentFoldersKeepsItsName() {
        val named = SelectionPlanner.nameFiles(
            listOf(PlannedFile(asset("y1", "Photo"), listOf("A")), PlannedFile(asset("y2", "Photo"), listOf("B"))),
        )
        assertEquals(listOf("A/Photo.jpg", "B/Photo.jpg"), named.map { it.path })
    }

    @Test
    fun hostileTitlesAndFolderNamesCannotEscapeTheZip() {
        val named = SelectionPlanner.nameFiles(
            listOf(PlannedFile(asset("z", "../../etc/passwd"), listOf("..", "a/b", "C:\\x"))),
        ).single()
        assertFalse(named.path.contains(".."))
        assertFalse(named.path.startsWith("/"))
        assertFalse(named.path.contains("\\"))
        assertEquals(3, named.directory.size)
        assertTrue(named.directory.all { it.isNotBlank() && '/' !in it })
    }

    @Test
    fun uniqueHandlesNamesWithoutAnExtension() {
        val taken = mutableSetOf<String>()
        assertEquals("note", SafeNames.unique(taken, "note"))
        assertEquals("note (1)", SafeNames.unique(taken, "note"))
        // Matches case-insensitively but keeps the caller's own casing.
        assertEquals("NOTE (2)", SafeNames.unique(taken, "NOTE"))
    }
}
