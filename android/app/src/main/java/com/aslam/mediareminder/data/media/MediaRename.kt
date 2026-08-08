package com.aslam.mediareminder.data.media

import com.aslam.mediareminder.data.db.entity.MediaAssetEntity

/**
 * Pure validation/normalization for MR-08 `updateMedia` (MR-03 "Edit
 * details"). Extracted from [com.aslam.mediareminder.media.MediaLibraryService.updateMedia]
 * so the title/notes rules — the part most likely to have an off-by-one or a
 * wrong empty-vs-absent distinction — are covered by plain JVM tests rather
 * than requiring a Room database.
 */
object MediaRename {

    /** `null` field means "leave this field alone" (the request key was absent); [Result.Invalid] means the caller explicitly sent something unacceptable. */
    sealed class Result {
        data class Ok(val title: String, val notes: String?) : Result()
        data class Invalid(val field: String) : Result()
    }

    /**
     * @param requestedTitle `null` when the request had no `title` key at all;
     *   present-but-blank is a validation error, not "no change" — an explicit
     *   empty string is the caller asking to blank the title out, which MR-09's
     *   1-160 character rule forbids.
     * @param notesKeyPresent whether the request had a `notes` key at all,
     *   independent of [requestedNotes]'s own nullability (a present `null`/
     *   empty value means "clear the notes," matching [MediaAssetEntity.notes]'s
     *   own optionality).
     */
    fun resolve(
        existingTitle: String,
        existingNotes: String?,
        requestedTitle: String?,
        requestedNotesTrimmed: String?,
        notesKeyPresent: Boolean,
    ): Result {
        val trimmedTitle = requestedTitle?.trim()
        if (trimmedTitle != null && trimmedTitle.isEmpty()) {
            return Result.Invalid("title")
        }
        val finalTitle = (trimmedTitle ?: existingTitle).take(MediaAssetEntity.MAX_TITLE_LENGTH)

        val finalNotes = if (notesKeyPresent) {
            requestedNotesTrimmed?.takeIf { it.isNotEmpty() }?.take(MediaAssetEntity.MAX_NOTES_LENGTH)
        } else {
            existingNotes
        }

        return Result.Ok(finalTitle, finalNotes)
    }
}
