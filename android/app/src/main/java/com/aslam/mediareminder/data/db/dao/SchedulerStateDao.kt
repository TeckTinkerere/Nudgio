package com.aslam.mediareminder.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.aslam.mediareminder.data.db.entity.SchedulerStateEntity

@Dao
interface SchedulerStateDao {
    @Query("SELECT * FROM scheduler_state WHERE id = ${SchedulerStateEntity.SINGLETON_ID}")
    suspend fun get(): SchedulerStateEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(state: SchedulerStateEntity)

    /** Bumps only the desired half of the outbox — step 1 of the pattern documented on the entity. */
    @Query(
        """
        UPDATE scheduler_state SET
            desired_occurrence_id = :desiredOccurrenceId,
            desired_at = :desiredAt,
            desired_generation = desired_generation + 1,
            last_reconcile_at = :now,
            last_reason = :reason
        WHERE id = ${SchedulerStateEntity.SINGLETON_ID}
        """,
    )
    suspend fun markDesired(desiredOccurrenceId: String?, desiredAt: Long?, now: Long, reason: String)

    /** Step 3: records that `AlarmManager` now reflects [generation]. */
    @Query(
        """
        UPDATE scheduler_state SET
            applied_generation = :generation,
            pending_intent_request_code = :requestCode,
            is_exact = :isExact,
            last_reconcile_at = :now,
            last_error_code = NULL
        WHERE id = ${SchedulerStateEntity.SINGLETON_ID}
        """,
    )
    suspend fun markApplied(generation: Long, requestCode: Int, isExact: Boolean, now: Long)

    @Query(
        """
        UPDATE scheduler_state SET last_reconcile_at = :now, last_error_code = :errorCode
        WHERE id = ${SchedulerStateEntity.SINGLETON_ID}
        """,
    )
    suspend fun markError(now: Long, errorCode: String)
}
