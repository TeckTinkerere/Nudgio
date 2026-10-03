package com.aslam.mediareminder.data.media

import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle

/**
 * MIME type -> MR-09 media kind and storage extension.
 *
 * Pure, so the classification rules are unit-testable without a device. This
 * matters more than it looks: the kind decides which metadata probe runs, which
 * icon the Library shows and whether the file is accepted at all, and content
 * providers return a wide range of type strings for the same file (`audio/mp4`
 * vs `audio/m4a`, casing, and `;codecs=` parameters).
 */
object MediaKinds {

    /**
     * Extension used for the opaque `<uuid>.<ext>` storage key.
     *
     * A fixed table rather than `MimeTypeMap`: that class is an Android
     * platform API (so it would drag this file into instrumented-test-only
     * territory), its answers vary by OEM, and for an app-private filename the
     * extension only needs to be stable and roughly accurate — Media3 and
     * `MediaMetadataRetriever` both sniff container format from the bytes, not
     * from our filename.
     */
    private val EXTENSION_BY_MIME = mapOf(
        "video/mp4" to "mp4",
        "video/quicktime" to "mov",
        "video/x-matroska" to "mkv",
        "video/webm" to "webm",
        "video/3gpp" to "3gp",
        "audio/mpeg" to "mp3",
        "audio/mp4" to "m4a",
        "audio/m4a" to "m4a",
        "audio/aac" to "aac",
        "audio/ogg" to "ogg",
        "audio/opus" to "opus",
        "audio/wav" to "wav",
        "audio/x-wav" to "wav",
        "audio/flac" to "flac",
        "image/jpeg" to "jpg",
        "image/png" to "png",
        "image/webp" to "webp",
        "image/gif" to "gif",
        "image/heif" to "heif",
        "image/heic" to "heic",
        "text/plain" to "txt",
    )

    /**
     * Strips provider noise so `Video/MP4; codecs="avc1"` classifies the same
     * as `video/mp4`. Lowercased and parameter-free.
     */
    fun normalize(mimeType: String?): String =
        mimeType?.substringBefore(';')?.trim()?.lowercase().orEmpty()

    /**
     * MR-09 kind, or `null` when the type is not something v1 accepts.
     *
     * Falls back to the type's top-level group so an unlisted but valid subtype
     * (a new video container, say) still imports as a video rather than being
     * rejected — the byte-level probe is what ultimately decides playability,
     * and [MediaAssetEntity.INTEGRITY_UNSUPPORTED] records that outcome.
     */
    fun kindOf(mimeType: String?): String? {
        val normalized = normalize(mimeType)
        if (normalized.isEmpty()) return null
        return when (normalized.substringBefore('/')) {
            "video" -> MediaAssetEntity.KIND_VIDEO
            "audio" -> MediaAssetEntity.KIND_AUDIO
            "image" -> MediaAssetEntity.KIND_IMAGE
            "text" -> MediaAssetEntity.KIND_TEXT
            else -> null
        }
    }

    fun isSupported(mimeType: String?): Boolean = kindOf(mimeType) != null

    /** Extension for the storage key, defaulting to a per-kind fallback then `bin`. */
    fun extensionFor(mimeType: String?): String {
        val normalized = normalize(mimeType)
        EXTENSION_BY_MIME[normalized]?.let { return it }
        return when (kindOf(normalized)) {
            MediaAssetEntity.KIND_VIDEO -> "mp4"
            MediaAssetEntity.KIND_AUDIO -> "m4a"
            MediaAssetEntity.KIND_IMAGE -> "jpg"
            MediaAssetEntity.KIND_TEXT -> "txt"
            else -> "bin"
        }
    }

    /**
     * Title derived from a provider display name.
     *
     * The extension is dropped because the user sees this as a label, and it is
     * clamped to MR-09's 160-character limit. A blank or absent display name
     * falls back to a kind-based label rather than an empty title, which would
     * render as an unreadable blank row in the Library.
     */
    /**
     * A readable title from the picked file's display name.
     *
     * Android's Photo Picker deliberately reports a numeric media ID as the
     * display name (`1000000033.jpg`) rather than the real file name, so
     * every photo or video picked through it used to arrive titled
     * "1000000033". A name with no letters in it says nothing to a person;
     * those fall back to the kind plus the import date ("Video · 2 Oct 2026").
     */
    fun titleFrom(displayName: String?, kind: String, importedOn: LocalDate = LocalDate.now()): String {
        val base = displayName
            ?.substringBeforeLast('.')
            ?.trim()
            ?.takeIf { name -> name.any { it.isLetter() } }
            ?: defaultTitleFor(kind, importedOn)
        return base.take(MediaAssetEntity.MAX_TITLE_LENGTH)
    }

    private fun defaultTitleFor(kind: String, importedOn: LocalDate): String {
        val noun = when (kind) {
            MediaAssetEntity.KIND_VIDEO -> "Video"
            MediaAssetEntity.KIND_AUDIO -> "Audio"
            MediaAssetEntity.KIND_IMAGE -> "Photo"
            MediaAssetEntity.KIND_TEXT -> "Note"
            else -> "Item"
        }
        return "$noun · ${importedOn.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.MEDIUM))}"
    }
}
