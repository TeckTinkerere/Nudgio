package com.aslam.mediareminder.data.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * MR-09 `reminders` table.
 *
 * `mediaId` is deliberately a bare column with **no** `@ForeignKey` to a
 * media-assets table: that table does not exist yet (media import/streaming
 * is still owned by the empty `media/` package — see its README). Adding a
 * real `media_assets` entity now, without the import pipeline behind it,
 * would be schema theatre. This is a scoped, documented gap
 * (docs/decision-log.md), not a silent one; it becomes a real `@ForeignKey`
 * the moment the media import slice lands, via a Room migration.
 *
 * `profileId` *does* get a foreign key — `reminder_profiles` is real and
 * fully seeded in this slice.
 */
@Entity(
    tableName = "reminders",
    foreignKeys = [
        ForeignKey(
            entity = ReminderProfileEntity::class,
            parentColumns = ["id"],
            childColumns = ["profile_id"],
            onDelete = ForeignKey.RESTRICT,
        ),
    ],
    indices = [
        Index(value = ["profile_id"]),
        Index(value = ["media_id"]),
        Index(value = ["effective_state", "updated_at"]),
    ],
)
data class ReminderEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "media_id")
    val mediaId: String,

    @ColumnInfo(name = "profile_id")
    val profileId: String,

    @ColumnInfo(name = "label")
    val label: String,

    @ColumnInfo(name = "notes")
    val notes: String?,

    /** The user's desired enabled state (MR-09). */
    @ColumnInfo(name = "enabled_intent")
    val enabledIntent: Boolean,

    /** Derived but persisted for fast queries and backup transparency (MR-09). */
    @ColumnInfo(name = "effective_state")
    val effectiveState: String,

    @ColumnInfo(name = "snooze_default_minutes")
    val snoozeDefaultMinutes: Int,

    @ColumnInfo(name = "snooze_allow_custom")
    val snoozeAllowCustom: Boolean,

    @ColumnInfo(name = "snooze_minimum_minutes")
    val snoozeMinimumMinutes: Int,

    @ColumnInfo(name = "snooze_maximum_minutes")
    val snoozeMaximumMinutes: Int,

    @ColumnInfo(name = "history_enabled")
    val historyEnabled: Boolean,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long,

    @ColumnInfo(name = "entity_version", defaultValue = "1")
    val entityVersion: Int = 1,
) {
    companion object {
        const val STATE_DISABLED = "disabled"
        const val STATE_NEEDS_SETUP = "needs_setup"
        const val STATE_ACTIVE = "active"
        const val STATE_ARCHIVED = "archived"
    }
}
