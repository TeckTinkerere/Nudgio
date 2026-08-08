package com.aslam.mediareminder.data.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * MR-09 `media_assets` table.
 *
 * Columns mirror the MR-09 table definition exactly, including its stated
 * constraints. Two deliberate deviations, both documented rather than silent:
 *
 *  - `category_id` is a bare nullable column with **no** `@ForeignKey`, because
 *    the `categories` table does not exist yet. This is the same scoped-gap
 *    pattern [ReminderEntity] used for `media_id` before this slice, and it
 *    becomes a real foreign key with `onDelete = SET_NULL` (MR-09) in the
 *    migration that introduces `categories`.
 *  - No source gallery URI column. MR-09 is explicit: "No source gallery URI is
 *    required after copy", and ADR-010 has the importer release source access
 *    once the bytes are copied and hashed. Storing it would create a path that
 *    breaks when the user moves or deletes the original — the exact failure
 *    ADR-010 exists to avoid.
 *
 * `storage_key` is the opaque `<uuid>.<ext>` filename under the app-private
 * media directory, never a path and never user-supplied (MR-09 "File storage":
 * "No user-supplied path segment enters the file path"). It is UNIQUE so a
 * half-finished import can never leave two rows pointing at one file.
 *
 * `sha256` is indexed because MR-09 lists `media_assets(sha256)` as a required
 * index — duplicate detection on import reads it on every import.
 */
@Entity(
    tableName = "media_assets",
    indices = [
        Index(value = ["storage_key"], unique = true),
        Index(value = ["sha256"]),
        Index(value = ["category_id", "updated_at"]),
    ],
)
data class MediaAssetEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    /** One of [KIND_VIDEO], [KIND_AUDIO], [KIND_IMAGE], [KIND_TEXT]. */
    @ColumnInfo(name = "kind")
    val kind: String,

    /** MR-09: 1-160 Unicode scalars. Enforced by the importer, not by SQLite. */
    @ColumnInfo(name = "title")
    val title: String,

    /** MR-09: max 4000 characters. */
    @ColumnInfo(name = "notes")
    val notes: String?,

    /** Opaque `<uuid>.<ext>` filename, relative to the private media dir. */
    @ColumnInfo(name = "storage_key")
    val storageKey: String,

    @ColumnInfo(name = "mime_type")
    val mimeType: String,

    @ColumnInfo(name = "size_bytes")
    val sizeBytes: Long,

    /** 64 lowercase hex characters of the copied bytes (ADR-010). */
    @ColumnInfo(name = "sha256")
    val sha256: String,

    @ColumnInfo(name = "duration_ms")
    val durationMs: Long?,

    @ColumnInfo(name = "width_px")
    val widthPx: Int?,

    @ColumnInfo(name = "height_px")
    val heightPx: Int?,

    @ColumnInfo(name = "category_id")
    val categoryId: String?,

    /** One of the `INTEGRITY_*` constants below. */
    @ColumnInfo(name = "integrity_state")
    val integrityState: String,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long,

    @ColumnInfo(name = "entity_version", defaultValue = "1")
    val entityVersion: Int = 1,

    /**
     * Opaque `<id>.webp` filename under [com.aslam.mediareminder.media.MediaStorage.thumbnailsDir],
     * or null when generation failed or the kind has nothing to depict (text,
     * art-less audio). MR-09: "Derived thumbnails are WebP cache and may be
     * cleared at any time" — this column can point at a file the OS has since
     * reclaimed; [com.aslam.mediareminder.media.MediaDtoWriter] does not
     * re-check existence on every read (that cost belongs at render time,
     * where `MediaCard` already has a broken-image fallback).
     */
    @ColumnInfo(name = "thumbnail_path")
    val thumbnailPath: String? = null,
) {
    companion object {
        const val KIND_VIDEO = "video"
        const val KIND_AUDIO = "audio"
        const val KIND_IMAGE = "image"
        const val KIND_TEXT = "text"

        const val INTEGRITY_HEALTHY = "healthy"
        const val INTEGRITY_UNCHECKED = "unchecked"
        const val INTEGRITY_MISSING = "missing"
        const val INTEGRITY_CHANGED = "changed"
        const val INTEGRITY_UNSUPPORTED = "unsupported"

        /** MR-09 "Storage limits": text title 160 characters, notes 4000. */
        const val MAX_TITLE_LENGTH = 160
        const val MAX_NOTES_LENGTH = 4000

        val KINDS: Set<String> = setOf(KIND_VIDEO, KIND_AUDIO, KIND_IMAGE, KIND_TEXT)

        val INTEGRITY_STATES: Set<String> = setOf(
            INTEGRITY_HEALTHY,
            INTEGRITY_UNCHECKED,
            INTEGRITY_MISSING,
            INTEGRITY_CHANGED,
            INTEGRITY_UNSUPPORTED,
        )
    }
}
