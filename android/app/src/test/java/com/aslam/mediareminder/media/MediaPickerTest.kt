package com.aslam.mediareminder.media

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * [MediaPicker.buildIntent] itself constructs real Android `Intent` objects
 * and is left to instrumentation tests; [MediaPicker.preferSystemPhotoPicker]
 * is the pure decision behind it and is fully covered here.
 */
class MediaPickerTest {

    private val photoPickerSdk = 33 // Build.VERSION_CODES.TIRAMISU
    private val preTiramisuSdk = 32

    @Test
    fun `prefers the system photo picker for pure visual requests on API 33+`() {
        assertTrue(MediaPicker.preferSystemPhotoPicker(listOf("image/*"), photoPickerSdk))
        assertTrue(MediaPicker.preferSystemPhotoPicker(listOf("video/*"), photoPickerSdk))
        assertTrue(MediaPicker.preferSystemPhotoPicker(listOf("image/*", "video/*"), photoPickerSdk))
    }

    @Test
    fun `falls back to SAF below API 33 even for visual requests`() {
        assertFalse(MediaPicker.preferSystemPhotoPicker(listOf("image/*"), preTiramisuSdk))
    }

    @Test
    fun `falls back to SAF for audio, which the photo picker cannot show`() {
        assertFalse(MediaPicker.preferSystemPhotoPicker(listOf("audio/*"), photoPickerSdk))
    }

    @Test
    fun `a mixed visual-and-audio request falls back to SAF entirely`() {
        // The photo picker has no audio mode, so it cannot serve any part of
        // a request that includes it — the whole request goes to SAF rather
        // than silently dropping the audio filter.
        assertFalse(MediaPicker.preferSystemPhotoPicker(listOf("image/*", "audio/*"), photoPickerSdk))
    }

    @Test
    fun `an empty type list falls back to SAF`() {
        assertFalse(MediaPicker.preferSystemPhotoPicker(emptyList(), photoPickerSdk))
    }
}
