package com.aslam.mediareminder.data.media

import com.aslam.mediareminder.data.db.entity.MediaAssetEntity

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
    fun titleFrom(displayName: String?, kind: String): String {
        val base = displayName
            ?.substringBeforeLast('.')
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: defaultTitleFor(kind)
        return base.take(MediaAssetEntity.MAX_TITLE_LENGTH)
    }

    private fun defaultTitleFor(kind: String): String = when (kind) {
        MediaAssetEntity.KIND_VIDEO -> "Imported video"
        MediaAssetEntity.KIND_AUDIO -> "Imported audio"
        MediaAssetEntity.KIND_IMAGE -> "Imported image"
        MediaAssetEntity.KIND_TEXT -> "Imported text"
        else -> "Imported item"
    }
}
