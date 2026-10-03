package com.aslam.mediareminder.media

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import java.io.File

/**
 * Saves a copy of a managed asset into the device's own media collections, so
 * it appears in Gallery/Photos/Files under a recognisable Nudgio folder.
 *
 * **This is an export, never the alarm's source of truth.** The managed copy
 * under `filesDir/media/` stays authoritative, and that is a deliberate
 * architecture decision rather than an omission (docs/plans/durable-media.md):
 *
 *  - A MediaStore item is deletable by the user, by any app holding media
 *    permission, and by every gallery-cleanup tool. Making it the asset of
 *    record would re-create the exact failure durable storage exists to
 *    prevent — "the user cleans their gallery" is the originating scenario.
 *  - MediaStore files **survive uninstall**. App-private media leaves with the
 *    app; a mirrored copy would strand hundreds of megabytes of someone's
 *    personal photos on a device they thought they had cleaned up.
 *  - App-private media is readable by no other app. `Pictures/Nudgio/` is
 *    readable by anything with `READ_MEDIA_IMAGES`. Silently widening that for
 *    an app whose whole pitch is local-first would be a privacy regression.
 *
 * So the user gets the visible album when they ask for it, per item, and the
 * reminder never depends on it.
 *
 * Three collections, not one folder: Android models images, video and audio
 * separately, and forcing an `.mp3` into `Pictures/` would leave it invisible
 * to every music app and mis-scanned by the media scanner. `Pictures/Nudgio`,
 * `Movies/Nudgio` and `Music/Nudgio` are the correct homes, and the shared
 * `Nudgio` leaf is what makes them read as one thing to the user.
 */
object MediaStoreExporter {

    /** The folder leaf under each collection — the part the user recognises. */
    const val ALBUM_NAME = "Nudgio"

    /**
     * `RELATIVE_PATH` and `IS_PENDING` both arrived in API 29. Below that,
     * writing into shared storage needs `WRITE_EXTERNAL_STORAGE`, and the
     * brief is explicit: do not introduce broad storage permissions merely to
     * make an implementation easier. On API 26-28 the caller falls back to the
     * share sheet, which reaches the same destinations through the user's own
     * choice and needs no permission at all.
     */
    fun isSupported(sdkInt: Int = Build.VERSION.SDK_INT): Boolean =
        sdkInt >= Build.VERSION_CODES.Q

    /**
     * Collection for a kind, or null when the kind has no business in the
     * device's media store. `text` is app-only content — there is no
     * MediaStore collection for a note, and `Downloads` would be a lie.
     */
    fun collectionFor(kind: String): Uri? = when (kind) {
        MediaAssetEntity.KIND_IMAGE -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        MediaAssetEntity.KIND_VIDEO -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        MediaAssetEntity.KIND_AUDIO -> MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
        else -> null
    }

    /**
     * `Pictures/Nudgio`, `Movies/Nudgio` or `Music/Nudgio`.
     *
     * Built from `Environment`'s standard-directory constants rather than
     * string literals, which means it cannot be meaningfully asserted in a
     * plain JVM test — the unit-test android.jar returns null for them, so
     * every kind would compare equal to every other. The destinations are an
     * instrumentation concern; what the JVM test can check is which kinds
     * have a destination at all.
     */
    fun relativePathFor(kind: String): String? {
        val base = when (kind) {
            MediaAssetEntity.KIND_IMAGE -> Environment.DIRECTORY_PICTURES
            MediaAssetEntity.KIND_VIDEO -> Environment.DIRECTORY_MOVIES
            MediaAssetEntity.KIND_AUDIO -> Environment.DIRECTORY_MUSIC
            else -> return null
        }
        return "$base/$ALBUM_NAME"
    }

    /**
     * A filename the user will recognise in their gallery, derived from the
     * asset's title rather than its opaque storage key.
     *
     * Every character outside a conservative allowlist collapses to `-`, which
     * is the same "no user-supplied path segment reaches the filesystem
     * verbatim" rule `MediaStorage` applies — except here a readable name is
     * the whole point, so the title is sanitised rather than discarded. The
     * result can never contain a separator, a traversal sequence or a leading
     * dot, and is capped well under any filesystem's limit.
     *
     * MediaStore itself de-duplicates a colliding display name by appending
     * ` (1)`, so two assets with the same title stay distinct without this
     * having to guess at uniqueness.
     */
    fun displayNameFor(title: String, storageKey: String): String {
        val extension = storageKey.substringAfterLast('.', "")
        val stem = title
            .map { if (it.isLetterOrDigit() || it in SAFE_PUNCTUATION) it else '-' }
            .joinToString("")
            .trim()
            .trim('.', '-')
            .take(MAX_NAME_STEM)
            .ifBlank { ALBUM_NAME }
        return if (extension.isBlank()) stem else "$stem.$extension"
    }

    /**
     * Streams [source] into the device's media collection, returning the new
     * `content://` item, or null when the platform or kind does not support it.
     *
     * `IS_PENDING` is set for the duration of the write and cleared after, so
     * no gallery app can show a half-copied video — the one supported
     * mechanism Android offers here, and the honest answer to "is there a way
     * to protect the file": no, `IS_PENDING` guards an in-progress write, not
     * a finished item, and nothing stops the device owner deleting their own
     * file afterwards. That is Android working as intended.
     *
     * A failure part-way deletes the pending row, so a cancelled or failed
     * save never leaves a truncated item behind in the user's gallery.
     */
    fun saveCopy(context: Context, entity: MediaAssetEntity, source: File): Uri? {
        if (!isSupported()) return null
        val collection = collectionFor(entity.kind) ?: return null
        val relativePath = relativePathFor(entity.kind) ?: return null
        if (!source.exists()) return null

        val resolver = context.contentResolver
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, displayNameFor(entity.title, entity.storageKey))
            put(MediaStore.MediaColumns.MIME_TYPE, entity.mimeType)
            put(MediaStore.MediaColumns.RELATIVE_PATH, relativePath)
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }

        val target = resolver.insert(collection, values) ?: return null
        val copied = runCatching {
            resolver.openOutputStream(target)?.use { output ->
                source.inputStream().use { input ->
                    input.copyTo(output, MediaStorage.COPY_BUFFER_BYTES)
                }
            } ?: throw IllegalStateException("Could not open the gallery destination")
        }

        if (copied.isFailure) {
            // Never leave a pending, half-written row in the user's gallery.
            runCatching { resolver.delete(target, null, null) }
            return null
        }

        resolver.update(
            target,
            ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) },
            null,
            null,
        )
        return target
    }

    /**
     * Punctuation kept verbatim in an exported filename.
     *
     * Legal on every filesystem Android writes to and none of it is a path
     * separator, a traversal character or a wildcard. The comma earns its
     * place: without it a title like "Photo - Oct 2, 2026" exported as
     * "Photo - Oct 2- 2026", which reads like a typo in the user's gallery.
     */
    private val SAFE_PUNCTUATION = setOf(' ', '-', '_', ',', '(', ')')

    /** Conservative cap: long enough to stay recognisable, short of any filesystem limit. */
    private const val MAX_NAME_STEM = 80
}
