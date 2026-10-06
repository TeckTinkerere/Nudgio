package com.aslam.mediareminder.media

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * [IncomingShare]'s trust rule. A share is input from any installed app, so
 * the cases that matter are the ones a hostile sender would try: pointing
 * Nudgio at its own private files.
 */
class IncomingShareTest {

    private val own = "com.aslam.mediareminder.fileprovider"

    @Test
    fun `accepts another app's content uri`() {
        assertTrue(IncomingShare.isAcceptable("content", "com.google.android.apps.photos.contentprovider", own))
        assertTrue(IncomingShare.isAcceptable("content", "media", own))
    }

    @Test
    fun `refuses file uris, which could name this app's private files`() {
        assertFalse(IncomingShare.isAcceptable("file", null, own))
        assertFalse(IncomingShare.isAcceptable("file", "", own))
    }

    @Test
    fun `refuses this app's own file provider`() {
        assertFalse(IncomingShare.isAcceptable("content", own, own))
    }

    @Test
    fun `refuses a content uri with no authority`() {
        assertFalse(IncomingShare.isAcceptable("content", null, own))
        assertFalse(IncomingShare.isAcceptable("content", "", own))
    }

    @Test
    fun `only media share types are taken`() {
        assertTrue(IncomingShare.isMediaType("video/mp4"))
        assertTrue(IncomingShare.isMediaType("image/*"))
        assertTrue(IncomingShare.isMediaType("audio/mpeg"))
        // A mixed SEND_MULTIPLE arrives as */*; each file is checked again on import.
        assertTrue(IncomingShare.isMediaType("*/*"))
        assertFalse(IncomingShare.isMediaType("text/plain"))
        assertFalse(IncomingShare.isMediaType("application/zip"))
        assertFalse(IncomingShare.isMediaType(null))
    }
}
