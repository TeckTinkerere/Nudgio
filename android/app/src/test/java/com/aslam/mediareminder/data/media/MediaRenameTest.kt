package com.aslam.mediareminder.data.media

import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MediaRenameTest {

    @Test
    fun `renaming only the title leaves notes untouched`() {
        val result = MediaRename.resolve(
            existingTitle = "Old title",
            existingNotes = "Existing notes",
            requestedTitle = "New title",
            requestedNotesTrimmed = null,
            notesKeyPresent = false,
        )

        val ok = result as MediaRename.Result.Ok
        assertEquals("New title", ok.title)
        assertEquals("Existing notes", ok.notes)
    }

    @Test
    fun `an explicit empty title is rejected, not treated as no-op`() {
        val result = MediaRename.resolve(
            existingTitle = "Old title",
            existingNotes = null,
            requestedTitle = "   ",
            requestedNotesTrimmed = null,
            notesKeyPresent = false,
        )

        assertEquals(MediaRename.Result.Invalid("title"), result)
    }

    @Test
    fun `an absent title key leaves the existing title unchanged`() {
        val result = MediaRename.resolve(
            existingTitle = "Old title",
            existingNotes = "Notes",
            requestedTitle = null,
            requestedNotesTrimmed = "Updated notes",
            notesKeyPresent = true,
        )

        val ok = result as MediaRename.Result.Ok
        assertEquals("Old title", ok.title)
        assertEquals("Updated notes", ok.notes)
    }

    @Test
    fun `an explicit blank notes value clears notes, unlike an absent notes key`() {
        val cleared = MediaRename.resolve(
            existingTitle = "Title",
            existingNotes = "Old notes",
            requestedTitle = null,
            requestedNotesTrimmed = "",
            notesKeyPresent = true,
        )
        assertNull((cleared as MediaRename.Result.Ok).notes)

        val untouched = MediaRename.resolve(
            existingTitle = "Title",
            existingNotes = "Old notes",
            requestedTitle = null,
            requestedNotesTrimmed = null,
            notesKeyPresent = false,
        )
        assertEquals("Old notes", (untouched as MediaRename.Result.Ok).notes)
    }

    @Test
    fun `title is trimmed before length clamping`() {
        val result = MediaRename.resolve(
            existingTitle = "Old",
            existingNotes = null,
            requestedTitle = "  Trimmed  ",
            requestedNotesTrimmed = null,
            notesKeyPresent = false,
        )
        assertEquals("Trimmed", (result as MediaRename.Result.Ok).title)
    }

    @Test
    fun `title is clamped to the MR-09 length limit`() {
        val tooLong = "a".repeat(500)
        val result = MediaRename.resolve(
            existingTitle = "Old",
            existingNotes = null,
            requestedTitle = tooLong,
            requestedNotesTrimmed = null,
            notesKeyPresent = false,
        )
        val ok = result as MediaRename.Result.Ok
        assertEquals(MediaAssetEntity.MAX_TITLE_LENGTH, ok.title.length)
    }

    @Test
    fun `notes is clamped to the MR-09 length limit`() {
        val tooLong = "a".repeat(5000)
        val result = MediaRename.resolve(
            existingTitle = "Title",
            existingNotes = null,
            requestedTitle = null,
            requestedNotesTrimmed = tooLong,
            notesKeyPresent = true,
        )
        val ok = result as MediaRename.Result.Ok
        assertEquals(MediaAssetEntity.MAX_NOTES_LENGTH, ok.notes?.length)
    }

    @Test
    fun `neither field present is a pure no-op`() {
        val result = MediaRename.resolve(
            existingTitle = "Title",
            existingNotes = "Notes",
            requestedTitle = null,
            requestedNotesTrimmed = null,
            notesKeyPresent = false,
        )
        val ok = result as MediaRename.Result.Ok
        assertEquals("Title", ok.title)
        assertEquals("Notes", ok.notes)
        assertTrue(true)
    }
}
