package com.aslam.mediareminder.data.db

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * DL-080 Reminder Actions: three nullable columns on `reminders`. Additive
 * `ALTER TABLE ... ADD COLUMN` only — every existing row keeps working with
 * "no action" (all three null), so nothing needs backfilling.
 */
val MIGRATION_6_7 = object : Migration(6, 7) {
    override fun migrate(db: SupportSQLiteDatabase) {
        db.execSQL("ALTER TABLE reminders ADD COLUMN action_type TEXT")
        db.execSQL("ALTER TABLE reminders ADD COLUMN action_uri TEXT")
        db.execSQL("ALTER TABLE reminders ADD COLUMN action_label TEXT")
    }
}
