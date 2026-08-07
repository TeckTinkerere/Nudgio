package com.aslam.mediareminder.data.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity

/**
 * MR-09 `idempotency_records`.
 *
 * "Alarm action records persist long enough to cover repeated notification
 * intents." A notification action `PendingIntent` can be delivered more than
 * once by the platform (duplicate broadcast, process restart mid-delivery);
 * [scope]+[key] lets [com.aslam.mediareminder.alarm.AlarmActionReceiver]
 * detect a replay and return the *original* result (MR-08:
 * `MR_ACTION_ALREADY_RESOLVED`, "Treated as success-like result") instead of
 * double-processing Play/Snooze/Dismiss.
 *
 * Retention (MR-09 "Data retention"): alarm action 7 days, UI mutation 24
 * hours, backup commit 30 days — enforced by
 * [com.aslam.mediareminder.data.db.dao.IdempotencyDao.deleteExpired], not by
 * this entity.
 */
@Entity(
    tableName = "idempotency_records",
    primaryKeys = ["scope", "key"],
)
data class IdempotencyRecordEntity(
    @ColumnInfo(name = "scope")
    val scope: String,

    /** e.g. `"$sessionId:$nonce"` for an alarm action. */
    @ColumnInfo(name = "key")
    val key: String,

    /** Hash of the semantic request, so a *different* request reusing the same key is rejected, not replayed. */
    @ColumnInfo(name = "request_hash")
    val requestHash: String,

    /** Serialized `ActionResult`/`MutationResult` — whatever was returned the first time. */
    @ColumnInfo(name = "result_summary")
    val resultSummary: String,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "expires_at")
    val expiresAt: Long,
) {
    companion object {
        const val SCOPE_ALARM_ACTION = "alarm_action"
        const val SCOPE_UI_MUTATION = "ui_mutation"
        const val SCOPE_BACKUP_COMMIT = "backup_commit"
    }
}
