package com.aslam.mediareminder.data.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * MR-10 "Atomicity and rollback" / MR-11 "Crash during replace": a durable
 * record of an in-flight (or just-finished) export/import operation, so a
 * process death mid-restore is recoverable on the next launch rather than
 * leaving Room in a half-applied state. This is what MR-10 calls "the
 * operation journal" — "Crash recovery examines phase and journal."
 *
 * One row per operation (`id` matches the MR-08 `OperationRef.operationId`
 * the JS side already tracks). Rows are retained briefly after `COMPLETE`
 * (so a just-finished operation's result can still be queried) and swept
 * opportunistically, matching the idempotency-record retention pattern
 * already used for [IdempotencyRecordEntity] (ADR-007: no polling —
 * swept at startup/on next write, never a background schedule).
 */
@Entity(tableName = "operation_journal")
data class OperationJournalEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    /** `import` | `export` | `backup_inspection` | `backup_commit` — MR-08 `OperationKind`. */
    @ColumnInfo(name = "kind")
    val kind: String,

    /** One of [Phase]'s values. Export uses the `Export*` subset; import uses the MR-10 state-machine subset. */
    @ColumnInfo(name = "phase")
    val phase: String,

    /** Private-storage path to the staged (copied-in) archive being validated/imported, if any. */
    @ColumnInfo(name = "staging_path")
    val stagingPath: String? = null,

    /** Private-storage path to the pre-Replace rollback snapshot directory, if one was created. */
    @ColumnInfo(name = "rollback_snapshot_path")
    val rollbackSnapshotPath: String? = null,

    /** MR-10 "Import token binds to staged archive digest" — set once inspection succeeds. */
    @ColumnInfo(name = "import_token")
    val importToken: String? = null,

    /** SHA-256 of the staged archive at inspection time — a changed digest at commit time invalidates [importToken]. */
    @ColumnInfo(name = "staged_digest")
    val stagedDigest: String? = null,

    /** `inspect_only` | `merge` | `replace`, import operations only. */
    @ColumnInfo(name = "mode")
    val mode: String? = null,

    /** Small JSON blob: final counts/filename/etc., populated once `phase` reaches a terminal state. */
    @ColumnInfo(name = "result_summary")
    val resultSummary: String? = null,

    @ColumnInfo(name = "error_code")
    val errorCode: String? = null,

    /** Cooperative cancellation — checked by the running export/import loop at safe boundaries; not a hard interrupt. */
    @ColumnInfo(name = "cancellation_requested", defaultValue = "0")
    val cancellationRequested: Boolean = false,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long,
) {
    object Phase {
        // Shared
        const val FAILED = "failed"
        const val CANCELLED = "cancelled"
        const val COMPLETE = "complete"

        // Export (MR-10 "Export algorithm")
        const val EXPORT_PREFLIGHT = "export_preflight"
        const val EXPORT_WRITING = "export_writing"
        const val EXPORT_FINALIZING = "export_finalizing"

        // Import (MR-10 "Atomicity and rollback" state machine)
        const val INSPECTED = "inspected"
        const val STAGED = "staged"
        const val ROLLBACK_READY = "rollback_ready"
        const val DB_PREPARED = "db_prepared"
        const val FILES_PROMOTED = "files_promoted"
        const val DB_COMMITTED = "db_committed"
        const val VERIFIED = "verified"
        const val SCHEDULED = "scheduled"

        /** Phases at or after which Room has already been mutated — crash recovery must roll *forward*, never backward, past this point. */
        val COMMITTED_OR_LATER = setOf(DB_COMMITTED, VERIFIED, SCHEDULED, COMPLETE)
    }
}
