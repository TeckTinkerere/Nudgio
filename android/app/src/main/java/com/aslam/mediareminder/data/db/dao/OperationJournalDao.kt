package com.aslam.mediareminder.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.aslam.mediareminder.data.db.entity.OperationJournalEntity

@Dao
interface OperationJournalDao {
    @Query("SELECT * FROM operation_journal WHERE id = :id")
    suspend fun getById(id: String): OperationJournalEntity?

    /** Startup crash-recovery scan: anything not yet `complete`/`failed`/`cancelled` when the process last died. */
    @Query("SELECT * FROM operation_journal WHERE phase NOT IN ('complete', 'failed', 'cancelled')")
    suspend fun getUnfinished(): List<OperationJournalEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: OperationJournalEntity)

    @Query("UPDATE operation_journal SET cancellation_requested = 1, updated_at = :now WHERE id = :id")
    suspend fun requestCancellation(id: String, now: Long)

    @Query("SELECT cancellation_requested FROM operation_journal WHERE id = :id")
    suspend fun isCancellationRequested(id: String): Boolean?

    /** MR-09-style retention: swept opportunistically (ADR-007 — no background schedule), not a fixed TTL column. */
    @Query("DELETE FROM operation_journal WHERE phase IN ('complete', 'failed', 'cancelled') AND updated_at < :cutoffEpochMs")
    suspend fun deleteFinishedBefore(cutoffEpochMs: Long): Int
}
