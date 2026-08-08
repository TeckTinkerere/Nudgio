package com.aslam.mediareminder.media

import android.content.Intent
import android.os.Build
import android.provider.MediaStore

/**
 * Builds the picker `Intent` for media import (ADR-011: "Use system pickers,
 * not broad gallery permission").
 *
 * Two mechanisms, chosen per request rather than hardcoded to one, matching
 * the MR-05 import table exactly ("Video: Photo Picker or document picker",
 * "Audio: Document picker", "Image: Photo Picker or document picker"):
 *
 *  - the system Photo Picker (`MediaStore.ACTION_PICK_IMAGES`) for image/video,
 *    which needs **no runtime permission at all** and only shows the device's
 *    visual media — the strongest ADR-011 fit when the request is visual;
 *  - Storage Access Framework (`Intent.ACTION_OPEN_DOCUMENT`) for everything
 *    else (audio, mixed requests, or Photo Picker being unavailable), which
 *    works uniformly from `minSdk 26` and is the only option for audio.
 *
 * [preferSystemPhotoPicker] is a pure predicate so the *decision* is
 * unit-testable on the plain JVM; the `Intent` objects themselves are
 * Android framework types and are exercised by instrumentation tests instead.
 */
object MediaPicker {

    /**
     * `MediaStore.ACTION_PICK_IMAGES` is a stable platform action from API 33
     * (`TIRAMISU`) — no Play Services module and no new dependency needed,
     * unlike the Jetpack `PickVisualMedia` contract, which requires
     * lifecycle-bound `ActivityResultRegistry` registration and cannot be
     * launched on demand from a `NativeModule` method call.
     */
    private const val MIN_SDK_FOR_PHOTO_PICKER = Build.VERSION_CODES.TIRAMISU

    /**
     * True when every requested MIME type starts with `image/` or `video/`
     * and the running platform actually has the Photo Picker. Any non-visual
     * type — audio, text, or a bare wildcard covering everything — forces
     * SAF, because the Photo Picker has no audio/document mode to fall back
     * to.
     *
     * (Deliberately not writing the literal MIME-wildcard form of these
     * examples here: Kotlin nests block comments, so a `/` immediately
     * followed by `*` inside a KDoc opens an unintended nested comment —
     * exactly the bug this file hit the first time this comment was written,
     * which manifested as "Missing '}'"/"Unclosed comment" swallowing the
     * rest of the file. See docs/decision-log.md DL-046 for the same class
     * of bug in a different file.)
     */
    fun preferSystemPhotoPicker(mimeTypes: List<String>, sdkInt: Int): Boolean =
        sdkInt >= MIN_SDK_FOR_PHOTO_PICKER &&
            mimeTypes.isNotEmpty() &&
            mimeTypes.all { it.startsWith("image/") || it.startsWith("video/") }

    fun buildIntent(mimeTypes: List<String>, sdkInt: Int = Build.VERSION.SDK_INT): Intent =
        if (preferSystemPhotoPicker(mimeTypes, sdkInt)) {
            // Single-select: multi-item import is out of v1 scope (TODO.md
            // "selected-item export" names the same P1.2 cut for the export
            // side), and MediaAssetEntity models exactly one row per import.
            Intent(MediaStore.ACTION_PICK_IMAGES).apply {
                type = if (mimeTypes.size == 1) mimeTypes[0] else "*/*"
            }
        } else {
            Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
                if (mimeTypes.isNotEmpty()) {
                    putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toTypedArray())
                }
                // No FLAG_GRANT_PERSISTABLE_URI_PERMISSION: ADR-011 is explicit
                // that this app does not keep long-term gallery/document
                // access. The transient read grant SAF attaches to the result
                // is enough — MediaImporter opens the stream immediately.
            }
        }
}
