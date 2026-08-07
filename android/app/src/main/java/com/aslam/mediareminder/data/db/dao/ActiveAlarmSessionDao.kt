package com.aslam.mediareminder.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.aslam.mediareminder.data.db.entity.ActiveAlarmSessionEntity

@Dao
interface ActiveAlarmSessionDao {
    @Query("SELECT * FROM active_alarm_session WHERE id = :id")
    suspend fun getById(id: String): ActiveAlarmSessionEntity?

    /** Every currently-alerting session, oldest first — [com.aslam.mediareminder.alarm.AlarmRingingService]'s recovery/queue-rebuild query for the multiple-simultaneous-reminders case. */
    @Query("SELECT * FROM active_alarm_session WHERE state = '${ActiveAlarmSessionEntity.STATE_ALERTING}' ORDER BY started_at ASC")
    suspend fun getAllAlerting(): List<ActiveAlarmSessionEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(session: ActiveAlarmSessionEntity)

    @Query("UPDATE active_alarm_session SET state = '${ActiveAlarmSessionEntity.STATE_RESOLVED}', last_update = :now WHERE id = :id")
    suspend fun resolve(id: String, now: Long)
}
