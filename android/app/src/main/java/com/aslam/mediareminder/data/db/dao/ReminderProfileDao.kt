package com.aslam.mediareminder.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.aslam.mediareminder.data.db.entity.ReminderProfileEntity

@Dao
interface ReminderProfileDao {
    @Query("SELECT * FROM reminder_profiles ORDER BY created_at ASC")
    suspend fun getAll(): List<ReminderProfileEntity>

    @Query("SELECT * FROM reminder_profiles WHERE id = :id")
    suspend fun getById(id: String): ReminderProfileEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(profile: ReminderProfileEntity)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAllIfAbsent(profiles: List<ReminderProfileEntity>)

    /** Backup Replace: built-ins are reseeded by [com.aslam.mediareminder.data.db.MediaReminderDatabase]'s own callback, never carried in from an archive (MR-10: "archive customizations import as a new custom profile unless user explicitly applies them"). */
    @Query("DELETE FROM reminder_profiles WHERE is_built_in = 0")
    suspend fun deleteAllCustom(): Int
}
