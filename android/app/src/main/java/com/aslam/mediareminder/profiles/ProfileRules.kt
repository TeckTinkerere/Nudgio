package com.aslam.mediareminder.profiles

import com.aslam.mediareminder.data.ReminderProfileSeed
import com.aslam.mediareminder.data.db.entity.ReminderProfileEntity

/**
 * The rules for saving, resetting and deleting an alert profile (DL-123,
 * FUN-008: "Profiles hold bounded ... timeout, retry and grace values").
 *
 * Plain Kotlin with no Room or Android calls, so every decision is unit-tested
 * on the JVM (`ProfileRulesTest`); [ProfileService] only reads rows, asks this
 * object what to do, and writes the answer. `lib/features/profiles/profile_rules.dart`
 * holds the same bounds for the editor, and its test mirrors this one.
 *
 * The bounds are the ones the rest of the app already enforces: a backup
 * clamps `timeoutSeconds` to 15..600 and `retryCount` to 0..3
 * (`BackupRecords`), and `AlarmRingingService` never rings longer than 600 s.
 * A profile therefore cannot make an alarm ring without end: MR-05 "Persistent
 * retry logic is bounded by retry count and absolute session lifetime".
 */
object ProfileRules {
    const val MIN_TIMEOUT_SECONDS = 15
    const val MAX_TIMEOUT_SECONDS = 600
    const val MIN_RETRY_COUNT = 0
    const val MAX_RETRY_COUNT = 3
    const val MIN_GRACE_SECONDS = 60
    const val MAX_GRACE_SECONDS = 3600
    const val MIN_SNOOZE_MINUTES = 1
    const val MAX_SNOOZE_MINUTES = 120
    const val MAX_NAME_LENGTH = 40

    /** Enough for real use; keeps the picker and every backup small. */
    const val MAX_CUSTOM_PROFILES = 20

    /** Built-in names are localization keys under this prefix (MR-13), so a user's name may not start with it. */
    const val BUILT_IN_NAME_PREFIX = "profile."

    /** What the editor sent. Every field is nullable so a missing one is reported, not thrown. */
    data class Input(
        val id: String?,
        val name: String?,
        val fullScreenWhenLocked: Boolean?,
        val timeoutSeconds: Int?,
        val retryCount: Int?,
        val graceSeconds: Int?,
        val defaultSnoozeMinutes: Int?,
        val expectedEntityVersion: Int?,
    )

    sealed class SavePlan {
        data class Insert(val profile: ReminderProfileEntity) : SavePlan()
        data class Update(val profile: ReminderProfileEntity) : SavePlan()
        data class Invalid(val field: String) : SavePlan()

        /** The row changed since the editor read it (MR-08: a stale `entityVersion` is rejected, never overwritten). */
        object Conflict : SavePlan()
        object NotFound : SavePlan()
    }

    /**
     * Trims and collapses whitespace. Null when the result is empty, too long,
     * holds a control character, or would read as a built-in's key.
     */
    fun cleanName(raw: String?): String? {
        val name = raw?.trim()?.replace(Regex("\\s+"), " ") ?: return null
        if (name.isEmpty() || name.length > MAX_NAME_LENGTH) return null
        if (name.any { it.isISOControl() }) return null
        if (name.startsWith(BUILT_IN_NAME_PREFIX, ignoreCase = true)) return null
        return name
    }

    /**
     * @param existing the row for `input.id`, or null when there is none.
     * @param all every stored profile, used for the name and count checks.
     */
    fun planSave(
        input: Input,
        existing: ReminderProfileEntity?,
        all: List<ReminderProfileEntity>,
        newId: String,
        nowMs: Long,
    ): SavePlan {
        // A new profile never chooses its own id: an id that matches nothing is a stale editor, not a create.
        if (input.id != null && existing == null) return SavePlan.NotFound
        if (existing != null && input.expectedEntityVersion != null &&
            input.expectedEntityVersion != existing.entityVersion
        ) {
            return SavePlan.Conflict
        }

        val timeout = input.timeoutSeconds?.takeIf { it in MIN_TIMEOUT_SECONDS..MAX_TIMEOUT_SECONDS }
            ?: return SavePlan.Invalid("timeoutSeconds")
        val retries = input.retryCount?.takeIf { it in MIN_RETRY_COUNT..MAX_RETRY_COUNT }
            ?: return SavePlan.Invalid("retryCount")
        val grace = input.graceSeconds?.takeIf { it in MIN_GRACE_SECONDS..MAX_GRACE_SECONDS }
            ?: return SavePlan.Invalid("graceSeconds")
        val snooze = input.defaultSnoozeMinutes?.takeIf { it in MIN_SNOOZE_MINUTES..MAX_SNOOZE_MINUTES }
            ?: return SavePlan.Invalid("defaultSnoozeMinutes")

        if (existing != null && existing.isBuiltIn) {
            // MR-05: "Users can edit safe values". A built-in keeps its name and
            // whether it rings: Gentle must stay the one that does not (MR-03).
            return SavePlan.Update(
                existing.copy(
                    timeoutSeconds = timeout,
                    retryCount = retries,
                    graceSeconds = grace,
                    defaultSnoozeMinutes = snooze,
                    updatedAt = nowMs,
                    entityVersion = existing.entityVersion + 1,
                ),
            )
        }

        val name = cleanName(input.name) ?: return SavePlan.Invalid("name")
        val fullScreen = input.fullScreenWhenLocked ?: return SavePlan.Invalid("fullScreenWhenLocked")
        val custom = all.filter { !it.isBuiltIn && it.id != existing?.id }
        if (custom.any { it.nameKey.equals(name, ignoreCase = true) }) return SavePlan.Invalid("name")

        if (existing != null) {
            return SavePlan.Update(
                existing.copy(
                    nameKey = name,
                    fullScreenWhenLocked = fullScreen,
                    timeoutSeconds = timeout,
                    retryCount = retries,
                    graceSeconds = grace,
                    defaultSnoozeMinutes = snooze,
                    updatedAt = nowMs,
                    entityVersion = existing.entityVersion + 1,
                ),
            )
        }

        if (custom.size >= MAX_CUSTOM_PROFILES) return SavePlan.Invalid("limit")
        return SavePlan.Insert(
            ReminderProfileEntity(
                id = newId,
                nameKey = name,
                isBuiltIn = false,
                fullScreenWhenLocked = fullScreen,
                timeoutSeconds = timeout,
                retryCount = retries,
                graceSeconds = grace,
                defaultSnoozeMinutes = snooze,
                createdAt = nowMs,
                updatedAt = nowMs,
            ),
        )
    }

    /** The built-in row put back to its seeded values, or null when [existing] is not a built-in. */
    fun planReset(existing: ReminderProfileEntity?, nowMs: Long): ReminderProfileEntity? {
        if (existing == null || !existing.isBuiltIn) return null
        val seed = ReminderProfileSeed.builtIn(existing.id) ?: return null
        return existing.copy(
            nameKey = seed.nameKey,
            fullScreenWhenLocked = seed.fullScreenWhenLocked,
            timeoutSeconds = seed.timeoutSeconds,
            retryCount = seed.retryCount,
            graceSeconds = seed.graceSeconds,
            defaultSnoozeMinutes = seed.defaultSnoozeMinutes,
            updatedAt = nowMs,
            entityVersion = existing.entityVersion + 1,
        )
    }

    enum class DeleteCheck { ALLOWED, NOT_FOUND, BUILT_IN, IN_USE }

    /** MR-05: a built-in is never deleted; a profile a reminder still uses is not either (the foreign key is `RESTRICT`). */
    fun checkDelete(existing: ReminderProfileEntity?, reminderCount: Int): DeleteCheck = when {
        existing == null -> DeleteCheck.NOT_FOUND
        existing.isBuiltIn -> DeleteCheck.BUILT_IN
        reminderCount > 0 -> DeleteCheck.IN_USE
        else -> DeleteCheck.ALLOWED
    }
}
