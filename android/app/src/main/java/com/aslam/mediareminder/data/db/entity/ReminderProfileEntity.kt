package com.aslam.mediareminder.data.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * ADR-018: three built-in profiles (Gentle, Standard, Persistent), seeded
 * with stable UUIDs in the v1 migration ([com.aslam.mediareminder.data.db.MIGRATION_CALLBACK]).
 *
 * `nameKey` deliberately stores a localization key for built-ins, never a
 * display string (MR-13: "Persist stable semantic values, never localized
 * display strings"). A future user-defined profile would store free text
 * here instead — the JS-side `isBuiltInProfileNameKey()` guard in
 * `ReminderEditorScreen`/`ReminderDetailScreen` is exactly the boundary that
 * distinguishes the two cases.
 *
 * Naming note (docs/decision-log.md): the third profile is "Persistent", not
 * "Critical" — ADR-021 forbids the app implying an emergency/guaranteed-
 * delivery capability it cannot back up, and "Critical" reads as exactly
 * that claim.
 */
@Entity(tableName = "reminder_profiles")
data class ReminderProfileEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String,

    @ColumnInfo(name = "name_key")
    val nameKey: String,

    @ColumnInfo(name = "is_built_in")
    val isBuiltIn: Boolean,

    @ColumnInfo(name = "full_screen_when_locked")
    val fullScreenWhenLocked: Boolean,

    /** MR-09: "Profile timeout range: 15-600 seconds." Enforced in the repository, not here. */
    @ColumnInfo(name = "timeout_seconds")
    val timeoutSeconds: Int,

    /** MR-09: "Retry count: 0-3 in v1." */
    @ColumnInfo(name = "retry_count")
    val retryCount: Int,

    @ColumnInfo(name = "grace_seconds")
    val graceSeconds: Int,

    @ColumnInfo(name = "default_snooze_minutes")
    val defaultSnoozeMinutes: Int,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long,

    @ColumnInfo(name = "entity_version", defaultValue = "1")
    val entityVersion: Int = 1,
) {
    companion object {
        /** ADR-018 stable IDs — identical to the JS-side seed in `mockNativeModule.ts` and `ReminderProfileSeed.kt`. */
        const val GENTLE_ID = "00000000-0000-4000-8000-000000000001"
        const val STANDARD_ID = "00000000-0000-4000-8000-000000000002"
        const val PERSISTENT_ID = "00000000-0000-4000-8000-000000000003"
    }
}
