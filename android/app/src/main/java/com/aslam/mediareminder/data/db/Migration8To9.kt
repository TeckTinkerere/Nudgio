package com.aslam.mediareminder.data.db

import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

/**
 * DL-118: `reminders.media_id` becomes nullable, so an alarm can exist without
 * an attachment. SQLite cannot drop a `NOT NULL` constraint in place, so the
 * table is rebuilt: create the new shape, copy every row, drop, rename.
 *
 * The one real danger is the drop. `schedule_rules` and `occurrences` reference
 * `reminders` with `ON DELETE CASCADE` (and `active_alarm_session` references
 * `occurrences` the same way). If foreign-key enforcement happens to be on while
 * the migration runs, `DROP TABLE reminders` deletes every child row, silently
 * discarding every user's schedules. Room currently enables enforcement only
 * after the migration, but that is an implementation detail this migration
 * must not depend on, and `PRAGMA foreign_keys` cannot be changed inside the
 * transaction a migration runs in. So the children are copied aside first and
 * `INSERT OR IGNORE`d back afterwards: a no-op when nothing cascaded, a full
 * restore when something did.
 *
 * Existing rows keep their `media_id`, so every current reminder behaves
 * exactly as before. The statements live in [STATEMENTS] so a test can run
 * them against a real SQLite database with foreign keys both on and off.
 */
val MIGRATION_8_9 = object : Migration(8, 9) {
    override fun migrate(db: SupportSQLiteDatabase) {
        Migration8To9.STATEMENTS.forEach { db.execSQL(it) }
    }
}

object Migration8To9 {

    val STATEMENTS: List<String> = listOf(
        """
        CREATE TABLE `reminders_new` (
            `id` TEXT NOT NULL,
            `media_id` TEXT,
            `profile_id` TEXT NOT NULL,
            `label` TEXT NOT NULL,
            `notes` TEXT,
            `enabled_intent` INTEGER NOT NULL,
            `effective_state` TEXT NOT NULL,
            `snooze_default_minutes` INTEGER NOT NULL,
            `snooze_allow_custom` INTEGER NOT NULL,
            `snooze_minimum_minutes` INTEGER NOT NULL,
            `snooze_maximum_minutes` INTEGER NOT NULL,
            `history_enabled` INTEGER NOT NULL,
            `created_at` INTEGER NOT NULL,
            `updated_at` INTEGER NOT NULL,
            `entity_version` INTEGER NOT NULL DEFAULT 1,
            `action_type` TEXT,
            `action_uri` TEXT,
            `action_label` TEXT,
            `media_start_ms` INTEGER,
            PRIMARY KEY(`id`),
            FOREIGN KEY(`profile_id`) REFERENCES `reminder_profiles`(`id`) ON UPDATE NO ACTION ON DELETE RESTRICT
        )
        """.trimIndent(),
        """
        INSERT INTO `reminders_new` (
            `id`, `media_id`, `profile_id`, `label`, `notes`, `enabled_intent`, `effective_state`,
            `snooze_default_minutes`, `snooze_allow_custom`, `snooze_minimum_minutes`, `snooze_maximum_minutes`,
            `history_enabled`, `created_at`, `updated_at`, `entity_version`,
            `action_type`, `action_uri`, `action_label`, `media_start_ms`
        )
        SELECT
            `id`, `media_id`, `profile_id`, `label`, `notes`, `enabled_intent`, `effective_state`,
            `snooze_default_minutes`, `snooze_allow_custom`, `snooze_minimum_minutes`, `snooze_maximum_minutes`,
            `history_enabled`, `created_at`, `updated_at`, `entity_version`,
            `action_type`, `action_uri`, `action_label`, `media_start_ms`
        FROM `reminders`
        """.trimIndent(),
        // Children copied aside so a cascading drop cannot lose them.
        "CREATE TABLE `_mig9_schedule_rules` AS SELECT * FROM `schedule_rules`",
        "CREATE TABLE `_mig9_occurrences` AS SELECT * FROM `occurrences`",
        "CREATE TABLE `_mig9_active_alarm_session` AS SELECT * FROM `active_alarm_session`",
        "DROP TABLE `reminders`",
        "ALTER TABLE `reminders_new` RENAME TO `reminders`",
        // Parents before children: occurrences before active_alarm_session.
        "INSERT OR IGNORE INTO `schedule_rules` SELECT * FROM `_mig9_schedule_rules`",
        "INSERT OR IGNORE INTO `occurrences` SELECT * FROM `_mig9_occurrences`",
        "INSERT OR IGNORE INTO `active_alarm_session` SELECT * FROM `_mig9_active_alarm_session`",
        "DROP TABLE `_mig9_schedule_rules`",
        "DROP TABLE `_mig9_occurrences`",
        "DROP TABLE `_mig9_active_alarm_session`",
        "CREATE INDEX IF NOT EXISTS `index_reminders_profile_id` ON `reminders` (`profile_id`)",
        "CREATE INDEX IF NOT EXISTS `index_reminders_media_id` ON `reminders` (`media_id`)",
        "CREATE INDEX IF NOT EXISTS `index_reminders_effective_state_updated_at` ON `reminders` (`effective_state`, `updated_at`)",
    )
}
