package com.aslam.mediareminder.data.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * MR-09 `occurrences` table.
 *
 * "Unique (reminder_id, occurrence_key) prevents recurrence duplication."
 * [occurrenceKey] is `"$kind:$scheduledAtEpochMs"` — deterministic given the
 * reminder's schedule rule, so recomputing the next occurrence for the same
 * due instant twice (e.g. after a crash-and-retry in the scheduler) always
 * collides with the existing row instead of inserting a duplicate. This is
 * also the "skip completed" mechanism the user asked for: an occurrence that
 * has already resolved (state != pending/claimed) is never recreated for the
 * same instant, so a reminder cannot re-fire for a slot it already handled.
 *
 * "Only a bounded horizon of future derived occurrences is stored" (MR-09) —
 * this schema stores at most one *pending* base occurrence per reminder at a
 * time (the next one), created by
 * [com.aslam.mediareminder.alarm.OccurrenceCalculator] and replaced once it
 * resolves, rather than materializing a calendar's worth of future rows.
 */
@Entity(
    tableName = "occurrences",
    foreignKeys = [
        ForeignKey(
            entity = ReminderEntity::class,
            parentColumns = ["id"],
            childColumns = ["reminder_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
    indices = [
        Index(value = ["state", "scheduled_at"]),
        Index(value = ["reminder_id", "occurrence_key"], unique = true),
    ],
)
data class OccurrenceEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "reminder_id")
    val reminderId: String,

    @ColumnInfo(name = "kind")
    val kind: String,

    @ColumnInfo(name = "parent_occurrence_id")
    val parentOccurrenceId: String? = null,

    @ColumnInfo(name = "scheduled_at")
    val scheduledAt: Long,

    @ColumnInfo(name = "occurrence_key")
    val occurrenceKey: String,

    @ColumnInfo(name = "state")
    val state: String,

    @ColumnInfo(name = "triggered_at")
    val triggeredAt: Long? = null,

    @ColumnInfo(name = "resolved_at")
    val resolvedAt: Long? = null,

    @ColumnInfo(name = "action")
    val action: String? = null,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    /**
     * MR-06 "Persistent retry is implemented as future one-shot alarms, not
     * an endlessly running service." 0 for every non-`retry` kind; a `retry`
     * occurrence's count of how many timeout-triggered re-alerts precede it
     * in its chain, capped by the reminder's profile `retryCount` (0-3,
     * MR-09) in [com.aslam.mediareminder.alarm.AlarmRingingService]'s
     * timeout handler. Added in schema v2 ([com.aslam.mediareminder.data.db.MIGRATION_1_2]).
     */
    @ColumnInfo(name = "retry_number", defaultValue = "0")
    val retryNumber: Int = 0,
) {
    companion object {
        const val KIND_BASE = "base"
        const val KIND_SNOOZE = "snooze"
        const val KIND_RETRY = "retry"
        const val KIND_TEST = "test"

        const val STATE_PENDING = "pending"
        const val STATE_CLAIMED = "claimed"
        const val STATE_ACCEPTED = "accepted"
        const val STATE_SNOOZED = "snoozed"
        const val STATE_DISMISSED = "dismissed"
        const val STATE_MISSED = "missed"
        const val STATE_TIMED_OUT = "timed_out"
        const val STATE_FAILED_SAFE = "failed_safe"

        /** MR-09-derived: the deterministic dedup/skip-completed key. */
        fun occurrenceKeyFor(kind: String, scheduledAtEpochMs: Long): String =
            "$kind:$scheduledAtEpochMs"
    }
}
