package com.aslam.mediareminder.data.db

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * DL-110, additive only — every existing row keeps its meaning with the new
 * columns null:
 *
 *  - `reminders.media_start_ms`: where playback begins when the reminder is
 *    opened. Null means "from the beginning".
 *  - `media_assets.source_sha256`: the digest of the bytes the user picked,
 *    when the stored file differs from them (lossless image compression).
 *    `sha256` stays the digest of the stored file, which backups and the
 *    integrity sweep verify; this column only lets a re-import of the same
 *    original still find the existing copy (DL-099).
 */
val MIGRATION_7_8 = object : Migration(7, 8) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE reminders ADD COLUMN media_start_ms INTEGER")
        db.execSQL("ALTER TABLE media_assets ADD COLUMN source_sha256 TEXT")
        db.execSQL("CREATE INDEX IF NOT EXISTS `index_media_assets_source_sha256` ON `media_assets` (`source_sha256`)")
    }
}
