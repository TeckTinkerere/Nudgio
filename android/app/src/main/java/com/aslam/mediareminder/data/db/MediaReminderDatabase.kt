package com.aslam.mediareminder.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import com.aslam.mediareminder.data.db.dao.ActiveAlarmSessionDao
import com.aslam.mediareminder.data.db.dao.IdempotencyDao
import com.aslam.mediareminder.data.db.dao.OccurrenceDao
import com.aslam.mediareminder.data.db.dao.OperationJournalDao
import com.aslam.mediareminder.data.db.dao.ReminderDao
import com.aslam.mediareminder.data.db.dao.ReminderProfileDao
import com.aslam.mediareminder.data.db.dao.ScheduleRuleDao
import com.aslam.mediareminder.data.db.dao.SchedulerStateDao
import com.aslam.mediareminder.data.db.entity.ActiveAlarmSessionEntity
import com.aslam.mediareminder.data.db.entity.IdempotencyRecordEntity
import com.aslam.mediareminder.data.db.entity.OccurrenceEntity
import com.aslam.mediareminder.data.db.entity.OperationJournalEntity
import com.aslam.mediareminder.data.db.entity.ReminderEntity
import com.aslam.mediareminder.data.db.entity.ReminderProfileEntity
import com.aslam.mediareminder.data.db.entity.ScheduleRuleEntity
import com.aslam.mediareminder.data.db.entity.SchedulerStateEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * MR-09: "Room is the authoritative application database." This is the
 * reminder-engine-plus-backup subset of the full MR-09 schema —
 * `media_assets`, `categories` and `tags` are not here yet (no media import
 * pipeline exists); see docs/decision-log.md for the explicit scope cut and
 * `media/README.md` for what still owns them. `operation_journal`
 * ([OperationJournalEntity]) backs the backup engine's crash-safe
 * export/import tracking and *is* real, added in schema v3.
 *
 * WAL mode and foreign keys are both MR-09 requirements ("Room uses WAL mode
 * where supported," "Foreign keys are enabled") and are the Room defaults on
 * API 26+ (this app's minSdk), so nothing extra is configured for either.
 *
 * Destructive migration is never enabled here — MR-09: "Destructive migration
 * is prohibited in release builds." Every schema change adds a real
 * `Migration` (see [MIGRATION_1_2]), never a `fallbackToDestructiveMigration()`
 * call.
 */
@Database(
    entities = [
        ReminderProfileEntity::class,
        ReminderEntity::class,
        ScheduleRuleEntity::class,
        OccurrenceEntity::class,
        SchedulerStateEntity::class,
        IdempotencyRecordEntity::class,
        ActiveAlarmSessionEntity::class,
        OperationJournalEntity::class,
    ],
    version = 3,
    exportSchema = true,
)
abstract class MediaReminderDatabase : RoomDatabase() {
    abstract fun reminderProfileDao(): ReminderProfileDao
    abstract fun reminderDao(): ReminderDao
    abstract fun scheduleRuleDao(): ScheduleRuleDao
    abstract fun occurrenceDao(): OccurrenceDao
    abstract fun schedulerStateDao(): SchedulerStateDao
    abstract fun idempotencyDao(): IdempotencyDao
    abstract fun activeAlarmSessionDao(): ActiveAlarmSessionDao
    abstract fun operationJournalDao(): OperationJournalDao

    companion object {
        /**
         * Mirrors the `@Database(version = ...)` annotation above — Room
         * requires that to be a literal, so this is a separate constant kept
         * manually in sync (bump both together). Exposed for the backup
         * engine's manifest `sourceSchemaVersion` field, which needs the
         * value at runtime, not just at annotation-processing time.
         */
        const val SCHEMA_VERSION = 3

        private const val DATABASE_NAME = "media_reminder.db"

        @Volatile
        private var instance: MediaReminderDatabase? = null

        fun getInstance(context: Context): MediaReminderDatabase =
            instance ?: synchronized(this) {
                instance ?: build(context.applicationContext).also { instance = it }
            }

        private fun build(context: Context): MediaReminderDatabase {
            // The callback needs a `ReminderProfileDao` to seed through, but
            // that dao only exists once `build()` returns. Calling
            // `getInstance(context)` recursively from inside the callback
            // would risk re-entering the `synchronized(this)` block below
            // before `instance` is assigned. A lazy supplier captured by
            // reference sidesteps that entirely: `onCreate` only fires on the
            // database's first real disk access, which cannot happen before
            // `build()` has returned and `database` has been assigned.
            lateinit var database: MediaReminderDatabase
            val callback = SeedBuiltInProfilesCallback { database }
            database = Room
                .databaseBuilder(context, MediaReminderDatabase::class.java, DATABASE_NAME)
                .addCallback(callback)
                .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                .build()
            return database
        }
    }

    /**
     * ADR-018: seeds Gentle/Standard/Persistent with their stable UUIDs the
     * first time the database file is created. Values match MR-09's
     * per-profile behavior parameters and the JS-side seed in
     * `mockNativeModule.ts`/`ReminderProfileSeed.kt` exactly, so demo-mode
     * and device behavior agree.
     *
     * Runs on `onCreate`, not every launch: MR-09 "Built-in profile changes
     * use stable IDs and explicit version migration, preserving user edits
     * unless reset" — a later profile-behavior change ships as a new Room
     * `Migration` that updates existing rows by ID, never as a reseed.
     */
    private class SeedBuiltInProfilesCallback(
        private val databaseProvider: () -> MediaReminderDatabase,
    ) : RoomDatabase.Callback() {
        override fun onCreate(db: SupportSQLiteDatabase) {
            super.onCreate(db)
            CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
                val dao = databaseProvider().reminderProfileDao()
                val now = System.currentTimeMillis()
                dao.insertAllIfAbsent(
                    listOf(
                        ReminderProfileEntity(
                            id = ReminderProfileEntity.GENTLE_ID,
                            nameKey = "profile.gentle.name",
                            isBuiltIn = true,
                            fullScreenWhenLocked = false,
                            timeoutSeconds = 60,
                            retryCount = 0,
                            graceSeconds = 300,
                            defaultSnoozeMinutes = 10,
                            createdAt = now,
                            updatedAt = now,
                        ),
                        ReminderProfileEntity(
                            id = ReminderProfileEntity.STANDARD_ID,
                            nameKey = "profile.standard.name",
                            isBuiltIn = true,
                            fullScreenWhenLocked = true,
                            timeoutSeconds = 300,
                            retryCount = 1,
                            graceSeconds = 600,
                            defaultSnoozeMinutes = 10,
                            createdAt = now,
                            updatedAt = now,
                        ),
                        ReminderProfileEntity(
                            id = ReminderProfileEntity.PERSISTENT_ID,
                            nameKey = "profile.persistent.name",
                            isBuiltIn = true,
                            fullScreenWhenLocked = true,
                            timeoutSeconds = 600,
                            retryCount = 3,
                            graceSeconds = 900,
                            defaultSnoozeMinutes = 5,
                            createdAt = now,
                            updatedAt = now,
                        ),
                    ),
                )
            }
        }
    }
}
