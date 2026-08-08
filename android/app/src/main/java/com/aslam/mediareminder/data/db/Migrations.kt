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

/**
 * Adds MR-09's `media_assets` table (see
 * [com.aslam.mediareminder.data.db.entity.MediaAssetEntity]) — the media
 * library slice. A new table, so no existing row needs a default.
 *
 * The column list and the three indices must stay byte-for-byte consistent with
 * what Room generates from the entity, or Room's identity-hash check fails at
 * open time with "Room cannot verify the data integrity" and the app cannot
 * start. `exportSchema = true` writes the expected schema to
 * `android/app/schemas/`, which is the reference when editing this.
 *
 * Note `reminders.media_id` still has no foreign key to this table. Adding one
 * requires recreating `reminders` (SQLite cannot add a constraint via ALTER),
 * and doing that in the same migration that introduces the parent table would
 * mean rebuilding a table full of live user rows before anything has been
 * verified against real imported media. It is deliberately deferred to its own
 * migration once the import pipeline is proven, and tracked in TODO.md — the
 * gap ReminderEntity's own comment already describes.
 */
val MIGRATION_3_4: Migration = object : Migration(3, 4) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS `media_assets` (
                `id` TEXT NOT NULL,
                `kind` TEXT NOT NULL,
                `title` TEXT NOT NULL,
                `notes` TEXT,
                `storage_key` TEXT NOT NULL,
                `mime_type` TEXT NOT NULL,
                `size_bytes` INTEGER NOT NULL,
                `sha256` TEXT NOT NULL,
                `duration_ms` INTEGER,
                `width_px` INTEGER,
                `height_px` INTEGER,
                `category_id` TEXT,
                `integrity_state` TEXT NOT NULL,
                `created_at` INTEGER NOT NULL,
                `updated_at` INTEGER NOT NULL,
                `entity_version` INTEGER NOT NULL DEFAULT 1,
                PRIMARY KEY(`id`)
            )
            """.trimIndent(),
        )
        db.execSQL(
            "CREATE UNIQUE INDEX IF NOT EXISTS `index_media_assets_storage_key` " +
                "ON `media_assets` (`storage_key`)",
        )
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS `index_media_assets_sha256` " +
                "ON `media_assets` (`sha256`)",
        )
        db.execSQL(
            "CREATE INDEX IF NOT EXISTS `index_media_assets_category_id_updated_at` " +
                "ON `media_assets` (`category_id`, `updated_at`)",
        )
    }
}

/**
 * Adds `media_assets.thumbnail_path` (see
 * [com.aslam.mediareminder.data.db.entity.MediaAssetEntity.thumbnailPath]) —
 * the real thumbnail-generation slice. Every pre-existing row defaults to
 * `NULL` ("no thumbnail yet"), which is exactly correct: nothing imported
 * before this migration has a generated thumbnail file on disk to point at.
 * `MediaCard`'s existing fallback-tile rendering already treats a missing
 * thumbnail as a normal, non-error state, so no backfill pass is needed.
 */
val MIGRATION_4_5: Migration = object : Migration(4, 5) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE media_assets ADD COLUMN thumbnail_path TEXT")
    }
}
