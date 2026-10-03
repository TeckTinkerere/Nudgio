package com.aslam.mediareminder.media

import android.os.Build
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Covers the two parts of [MediaStoreExporter] that genuinely run without a
 * device: the filename it derives from a user's title, and the platform gate.
 *
 * Its destinations are deliberately **not** asserted here. Both
 * `collectionFor` and `relativePathFor` are built from Android framework
 * constants (`MediaStore.Images.Media.EXTERNAL_CONTENT_URI`,
 * `Environment.DIRECTORY_PICTURES`, …), and the unit-test `android.jar`
 * returns null for every one of them — so an assertion there would compare
 * null to null, pass, and prove nothing about image going to Pictures or
 * audio going to Music. That belongs in an instrumentation test, the same
 * split [MediaStorageCompanionTest] already documents for `MediaStorage`.
 */
class MediaStoreExporterTest {

    @Test
    fun `below API 29 reports unsupported rather than taking a storage permission`() {
        // The brief's constraint: no broad storage permission just to make an
        // implementation easier. Pre-Q callers fall back to the share sheet.
        assertFalse(MediaStoreExporter.isSupported(Build.VERSION_CODES.P))
        assertTrue(MediaStoreExporter.isSupported(Build.VERSION_CODES.Q))
    }

    @Test
    fun `keeps a readable name and its extension`() {
        assertEquals(
            "Morning Motivation.mp4",
            MediaStoreExporter.displayNameFor("Morning Motivation", "9f8e-uuid.mp4"),
        )
    }

    @Test
    fun `keeps punctuation a date needs`() {
        // Without the comma this exported as "Photo - Oct 2- 2026", which
        // reads like a typo in the user's own gallery.
        assertEquals(
            "Photo - Oct 2, 2026.jpg",
            MediaStoreExporter.displayNameFor("Photo - Oct 2, 2026", "abc.jpg"),
        )
    }

    @Test
    fun `no title can escape the folder`() {
        // Separators and traversal collapse to the placeholder character, so
        // the result is always a single path segment. `MediaStorage` keeps
        // user text out of its paths entirely; here a readable name is the
        // point, so the title is sanitised rather than discarded.
        val name = MediaStoreExporter.displayNameFor("../../etc/passwd", "x.jpg")
        assertFalse(name.contains('/'))
        assertFalse(name.contains('\\'))
        assertFalse(name.startsWith("."))
    }

    @Test
    fun `a title of only punctuation still yields a usable name`() {
        assertEquals("Nudgio.jpg", MediaStoreExporter.displayNameFor("???", "x.jpg"))
    }

    @Test
    fun `a very long title is capped well under any filesystem limit`() {
        val name = MediaStoreExporter.displayNameFor("a".repeat(500), "x.jpg")
        assertTrue(name.length <= 90)
        assertTrue(name.endsWith(".jpg"))
    }

    @Test
    fun `a storage key with no extension still produces a name`() {
        assertEquals("Clip", MediaStoreExporter.displayNameFor("Clip", "no-extension"))
    }
}
