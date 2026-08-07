package com.aslam.mediareminder.data.db

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * MR-09 "Destructive migration is prohibited in release builds... every
 * future schema change adds a real Migration." Adds `occurrences.retry_number`
 * (see [com.aslam.mediareminder.data.db.entity.OccurrenceEntity.retryNumber])
 * for the presentation slice's timeout-triggered retry alarms
 * (docs/decision-log.md). Every existing row defaults to 0, correct for every
 * pre-existing occurrence (none of them are mid-retry-chain, since retries
 * did not exist before this migration).
 */
val MIGRATION_1_2: Migration = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE occurrences ADD COLUMN retry_number INTEGER NOT NULL DEFAULT 0")
    }
}

/**
 * Adds `operation_journal` (see
 * [com.aslam.mediareminder.data.db.entity.OperationJournalEntity]) for the
 * backup engine's crash-safe export/import phase tracking
 * (docs/decision-log.md, MR-10 "Atomicity and rollback"). A new table, not
 * an `ALTER TABLE` — no existing data needs a default value.
 */
val MIGRATION_2_3: Migration = object : Migration(2, 3) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `operation_journal` (
                `id` TEXT NOT NULL,
                `kind` TEXT NOT NULL,
                `phase` TEXT NOT NULL,
                `staging_path` TEXT,
                `rollback_snapshot_path` TEXT,
                `import_token` TEXT,
                `staged_digest` TEXT,
                `mode` TEXT,
                `result_summary` TEXT,
                `error_code` TEXT,
                `cancellation_requested` INTEGER NOT NULL DEFAULT 0,
                `created_at` INTEGER NOT NULL,
                `updated_at` INTEGER NOT NULL,
                PRIMARY KEY(`id`)
            )
            """.trimIndent(),
        )
    }
}
