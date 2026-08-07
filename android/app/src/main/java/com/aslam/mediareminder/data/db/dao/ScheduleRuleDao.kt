package com.aslam.mediareminder.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.aslam.mediareminder.data.db.entity.ScheduleRuleEntity

@Dao
interface ScheduleRuleDao {
    @Query("SELECT * FROM schedule_rules WHERE reminder_id = :reminderId")
    suspend fun getByReminderId(reminderId: String): ScheduleRuleEntity?

    /** Batched variant of [getByReminderId] for callers iterating many reminders at once (e.g. [com.aslam.mediareminder.alarm.SchedulerCoordinator]) — one query instead of N. */
    @Query("SELECT * FROM schedule_rules WHERE reminder_id IN (:reminderIds)")
    suspend fun getByReminderIds(reminderIds: List<String>): List<ScheduleRuleEntity>

    /** Backup export: every rule, joined to its reminder by [ScheduleRuleEntity.reminderId] at the call site. */
    @Query("SELECT * FROM schedule_rules")
    suspend fun getAll(): List<ScheduleRuleEntity>

    /** One-to-one with reminder (MR-09): replace is correct, there is never a second row to merge. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(rule: ScheduleRuleEntity)

    @Query("DELETE FROM schedule_rules WHERE reminder_id = :reminderId")
    suspend fun deleteByReminderId(reminderId: String)
}
