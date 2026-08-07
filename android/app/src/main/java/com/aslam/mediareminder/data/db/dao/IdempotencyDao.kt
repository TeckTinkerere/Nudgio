package com.aslam.mediareminder.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.aslam.mediareminder.data.db.entity.IdempotencyRecordEntity

@Dao
interface IdempotencyDao {
    @Query("SELECT * FROM idempotency_records WHERE scope = :scope AND `key` = :key")
    suspend fun find(scope: String, key: String): IdempotencyRecordEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(record: IdempotencyRecordEntity)

    /** MR-09 "Data retention": swept opportunistically, not on a background schedule (ADR-007: no polling). */
    @Query("DELETE FROM idempotency_records WHERE expires_at < :nowEpochMs")
    suspend fun deleteExpired(nowEpochMs: Long): Int
}
