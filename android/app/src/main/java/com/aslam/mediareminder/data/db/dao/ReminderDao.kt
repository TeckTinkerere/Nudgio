package com.aslam.mediareminder.data.db.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import com.aslam.mediareminder.data.db.entity.ReminderEntity

@Dao
interface ReminderDao {
    @Query("SELECT * FROM reminders ORDER BY updated_at DESC")
    suspend fun getAll(): List<ReminderEntity>

    /** SQL-filtered variant of [getAll] for callers that only ever want the enabled+active set (e.g. [com.aslam.mediareminder.alarm.SchedulerCoordinator]) — avoids loading archived/disabled reminders just to filter them out in Kotlin. */
    @Query("SELECT * FROM reminders WHERE enabled_intent = 1 AND effective_state = 'active' ORDER BY updated_at DESC")
    suspend fun getActive(): List<ReminderEntity>

    @Query("SELECT * FROM reminders WHERE id = :id")
    suspend fun getById(id: String): ReminderEntity?

    /** MR-03 "Delete" media flow: which reminders would be orphaned/cascaded by deleting a media asset. */
    @Query("SELECT * FROM reminders WHERE media_id = :mediaId")
    suspend fun getByMediaId(mediaId: String): List<ReminderEntity>

    @Query("SELECT COUNT(*) FROM reminders WHERE enabled_intent = 1")
    suspend fun countEnabled(): Int

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(reminder: ReminderEntity)

    /**
     * Optimistic-concurrency update (MR-08 "Event ordering and idempotency":
     * "Delete operations require current entity version to prevent
     * overwriting concurrent changes" — the same rule applies to updates).
     * Returns the number of rows changed; 0 means [expectedVersion] was
     * stale and the caller must reject the save rather than silently retry.
     */
    @Query(
        """
        UPDATE reminders SET
            media_id = :mediaId,
            profile_id = :profileId,
            label = :label,
            notes = :notes,
            enabled_intent = :enabledIntent,
            effective_state = :effectiveState,
            snooze_default_minutes = :snoozeDefaultMinutes,
            snooze_allow_custom = :snoozeAllowCustom,
            snooze_minimum_minutes = :snoozeMinimumMinutes,
            snooze_maximum_minutes = :snoozeMaximumMinutes,
            history_enabled = :historyEnabled,
            updated_at = :updatedAt,
            entity_version = entity_version + 1
        WHERE id = :id AND entity_version = :expectedVersion
        """,
    )
    suspend fun updateWithVersionCheck(
        id: String,
        mediaId: String,
        profileId: String,
        label: String,
        notes: String?,
        enabledIntent: Boolean,
        effectiveState: String,
        snoozeDefaultMinutes: Int,
        snoozeAllowCustom: Boolean,
        snoozeMinimumMinutes: Int,
        snoozeMaximumMinutes: Int,
        historyEnabled: Boolean,
        updatedAt: Long,
        expectedVersion: Int,
    ): Int

    @Query("UPDATE reminders SET enabled_intent = :enabled, effective_state = :effectiveState, updated_at = :updatedAt WHERE id = :id")
    suspend fun updateEnabled(id: String, enabled: Boolean, effectiveState: String, updatedAt: Long)

    @Update
    suspend fun update(reminder: ReminderEntity)

    @Delete
    suspend fun delete(reminder: ReminderEntity)

    @Query("DELETE FROM reminders WHERE id = :id")
    suspend fun deleteById(id: String): Int

    /** Backup Replace: cascades to `schedule_rules`/`occurrences`/`active_alarm_session` via their `ON DELETE CASCADE` foreign keys. */
    @Query("DELETE FROM reminders")
    suspend fun deleteAll(): Int
}
