package com.aslam.mediareminder.data.media

import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class MediaKindsTest {

    @Test
    fun `normalize strips codec parameters and casing`() {
        assertEquals("video/mp4", MediaKinds.normalize("Video/MP4; codecs=\"avc1\""))
        assertEquals("", MediaKinds.normalize(null))
        assertEquals("", MediaKinds.normalize(""))
    }

    @Test
    fun `kindOf classifies every top-level group`() {
        assertEquals(MediaAssetEntity.KIND_VIDEO, MediaKinds.kindOf("video/mp4"))
        assertEquals(MediaAssetEntity.KIND_AUDIO, MediaKinds.kindOf("audio/mpeg"))
        assertEquals(MediaAssetEntity.KIND_IMAGE, MediaKinds.kindOf("image/png"))
        assertEquals(MediaAssetEntity.KIND_TEXT, MediaKinds.kindOf("text/plain"))
    }

    @Test
    fun `kindOf accepts an unlisted subtype within a supported group`() {
        // The byte-level probe, not this classifier, is what ultimately
        // decides playability — an unfamiliar video container must still
        // reach that probe rather than being rejected on subtype alone.
        assertEquals(MediaAssetEntity.KIND_VIDEO, MediaKinds.kindOf("video/av1-experimental"))
    }

    @Test
    fun `kindOf rejects unsupported top-level types`() {
        assertNull(MediaKinds.kindOf("application/pdf"))
        assertNull(MediaKinds.kindOf("application/vnd.android.package-archive"))
        assertNull(MediaKinds.kindOf(null))
        assertNull(MediaKinds.kindOf(""))
    }

    @Test
    fun `isSupported matches kindOf nullability`() {
        assertTrue(MediaKinds.isSupported("image/jpeg"))
        assertFalse(MediaKinds.isSupported("application/zip"))
    }

    @Test
    fun `extensionFor uses the specific mapping when known`() {
        assertEquals("mp3", MediaKinds.extensionFor("audio/mpeg"))
        assertEquals("heic", MediaKinds.extensionFor("image/heic"))
    }

    @Test
    fun `extensionFor falls back to a per-kind default for an unmapped subtype`() {
        assertEquals("mp4", MediaKinds.extensionFor("video/some-new-codec"))
        assertEquals("m4a", MediaKinds.extensionFor("audio/some-new-codec"))
    }

    @Test
    fun `extensionFor falls back to bin for an unsupported type`() {
        assertEquals("bin", MediaKinds.extensionFor("application/pdf"))
    }

    @Test
    fun `titleFrom strips the extension and trims`() {
        assertEquals("holiday clip", MediaKinds.titleFrom("  holiday clip.mp4 ", MediaAssetEntity.KIND_VIDEO))
    }

    @Test
    fun `titleFrom falls back to a kind label when the display name is blank or absent`() {
        assertEquals("Imported video", MediaKinds.titleFrom(null, MediaAssetEntity.KIND_VIDEO))
        assertEquals("Imported audio", MediaKinds.titleFrom("   ", MediaAssetEntity.KIND_AUDIO))
    }

    @Test
    fun `titleFrom clamps to the MR-09 title length limit`() {
        val longName = "a".repeat(500) + ".mp4"
        val title = MediaKinds.titleFrom(longName, MediaAssetEntity.KIND_VIDEO)
        assertEquals(MediaAssetEntity.MAX_TITLE_LENGTH, title.length)
    }

    @Test
    fun `titleFrom only strips the last extension, not dots inside the name`() {
        assertEquals("v1.2 final", MediaKinds.titleFrom("v1.2 final.mov", MediaAssetEntity.KIND_VIDEO))
    }
}
