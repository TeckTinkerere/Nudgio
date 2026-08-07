package com.aslam.mediareminder.data.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * MR-09 `scheduler_state`: "Singleton row... an outbox record for
 * AlarmManager synchronization."
 *
 * ADR-016 / MR-07 "Scheduler transaction pattern": Room cannot atomically
 * commit alongside `AlarmManager.setAlarmClock()`, so scheduling is a
 * two-phase outbox instead of a single transaction:
 *
 *  1. a Room transaction updates reminder/occurrence data and bumps
 *     [desiredGeneration] — "what *should* be registered";
 *  2. [com.aslam.mediareminder.alarm.SchedulerCoordinator] applies that to
 *     `AlarmManager` outside the transaction;
 *  3. on success it writes [appliedGeneration] to match;
 *  4. if the process dies between 1 and 3, [desiredGeneration] !=
 *     [appliedGeneration] on next reconciliation (startup or
 *     `SystemEventReceiver`), and the coordinator retries;
 *  5. [AlarmDispatchReceiver][com.aslam.mediareminder.alarm.AlarmDispatchReceiver]
 *     validates its `PendingIntent`'s generation against this row, so a stale
 *     pending intent from a cancelled/superseded schedule can never fire
 *     against newer state (MR-06 AND-003 / the "stale PendingIntent" test).
 */
@Entity(tableName = "scheduler_state")
data class SchedulerStateEntity(
    /** Always [SINGLETON_ID] — enforced by the DAO only ever upserting this row. */
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: Int = SINGLETON_ID,

    @ColumnInfo(name = "desired_occurrence_id")
    val desiredOccurrenceId: String?,

    @ColumnInfo(name = "desired_at")
    val desiredAt: Long?,

    @ColumnInfo(name = "desired_generation")
    val desiredGeneration: Long,

    @ColumnInfo(name = "applied_generation")
    val appliedGeneration: Long,

    /** Identity for the registered `PendingIntent`'s request code. */
    @ColumnInfo(name = "pending_intent_request_code")
    val pendingIntentRequestCode: Int,

    /** Whether the currently-applied alarm is exact (`setAlarmClock`) or Limited (`setAndAllowWhileIdle`). */
    @ColumnInfo(name = "is_exact", defaultValue = "1")
    val isExact: Boolean = true,

    @ColumnInfo(name = "last_reconcile_at")
    val lastReconcileAt: Long,

    @ColumnInfo(name = "last_reason")
    val lastReason: String,

    @ColumnInfo(name = "last_error_code")
    val lastErrorCode: String? = null,
) {
    companion object {
        const val SINGLETON_ID = 1
    }
}
