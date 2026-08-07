package com.aslam.mediareminder.backup

import com.aslam.mediareminder.alarm.ScheduleRule
import com.aslam.mediareminder.data.db.entity.ReminderEntity
import com.aslam.mediareminder.data.db.entity.ReminderProfileEntity

data class BackupConflict(
    val id: String,
    val kind: String,
    val localSummary: String,
    val archiveSummary: String,
    val recommendedAction: String,
)

/**
 * The default, deterministic resolution `BackupImporter.commit()` actually
 * applies. MR-10: "Choices are deterministic and serializable so commit
 * uses the reviewed plan." Building a UI that lets a user override an
 * individual conflict's resolution before commit is out of scope for this
 * pass (docs/decision-log.md) — the plan computed here already follows
 * MR-10's own stated defaults for every rule, so "Inspect only" already
 * shows the user exactly what committing will do.
 */
data class BackupMergePlan(
    val conflicts: List<BackupConflict>,
    val remindersToInsert: List<ReminderEntity>,
    val remindersToUpdate: List<ReminderEntity>,
    val scheduleRulesToApply: Map<String, ScheduleRule>,
    val profilesToInsert: List<ReminderProfileEntity>,
    val skippedBuiltInProfileIds: List<String>,
)

object BackupConflictPlanner {

    /**
     * MR-10 "Merge" rules, scoped to what exists today (reminders and
     * profiles — media/category/tag rules are dormant no-ops until a data
     * model for them exists).
     */
    fun planMerge(
        archive: ValidatedBackup,
        localProfiles: List<ReminderProfileEntity>,
        localReminders: List<ReminderEntity>,
    ): BackupMergePlan {
        val localProfileIds = localProfiles.associateBy { it.id }
        val localReminderIds = localReminders.associateBy { it.id }
        val builtInIds = setOf(
            ReminderProfileEntity.GENTLE_ID,
            ReminderProfileEntity.STANDARD_ID,
            ReminderProfileEntity.PERSISTENT_ID,
        )

        val conflicts = mutableListOf<BackupConflict>()
        val profilesToInsert = mutableListOf<ReminderProfileEntity>()
        val skippedBuiltIn = mutableListOf<String>()

        for (archiveProfile in archive.profiles) {
            if (archiveProfile.id in builtInIds) {
                // MR-10: "built-in profile UUID: map to local built-in;
                // archive customizations import as a new custom profile
                // unless user explicitly applies them" — no such explicit
                // apply flow exists, so the archive's built-in row is never
                // applied; the local built-in (already seeded) wins by
                // construction.
                skippedBuiltIn += archiveProfile.id
                continue
            }
            val local = localProfileIds[archiveProfile.id]
            when {
                local == null -> profilesToInsert += archiveProfile
                isSameProfile(local, archiveProfile) -> Unit // same UUID, same content: reuse existing, no-op
                else -> {
                    conflicts += BackupConflict(
                        id = archiveProfile.id,
                        kind = "profile",
                        localSummary = "Local: ${local.nameKey}, updated ${local.updatedAt}",
                        archiveSummary = "Archive: ${archiveProfile.nameKey}, updated ${archiveProfile.updatedAt}",
                        recommendedAction = "keep_local",
                    )
                    // Default: keep local (spec gives no explicit default
                    // for this specific case; "keep local metadata" is the
                    // same conservative default the media-conflict rule
                    // uses, applied consistently here).
                }
            }
        }

        val remindersToInsert = mutableListOf<ReminderEntity>()
        val remindersToUpdate = mutableListOf<ReminderEntity>()
        val scheduleRulesToApply = mutableMapOf<String, ScheduleRule>()

        for (archiveReminder in archive.reminders) {
            val rule = archive.scheduleRules[archiveReminder.id] ?: continue // already warned in BackupSemanticValidator
            val local = localReminderIds[archiveReminder.id]
            when {
                local == null -> {
                    remindersToInsert += archiveReminder
                    scheduleRulesToApply[archiveReminder.id] = rule
                }
                isSameReminder(local, archiveReminder) -> Unit // same UUID, same semantic content: skip exact duplicate
                else -> {
                    conflicts += BackupConflict(
                        id = archiveReminder.id,
                        kind = "reminder",
                        localSummary = "Local: \"${local.label}\", updated ${local.updatedAt}",
                        archiveSummary = "Archive: \"${archiveReminder.label}\", updated ${archiveReminder.updatedAt}",
                        recommendedAction = "keep_archive",
                    )
                    // Default: newer `updatedAt` wins. MR-10's stated default
                    // ("keep both disabled only when times/profiles differ")
                    // describes the *different-UUID semantic-duplicate* case,
                    // which needs cross-reminder content comparison this
                    // pass does not implement (see docs/decision-log.md);
                    // for the same-UUID case actually reachable here, the
                    // most-recently-edited copy winning is the conservative,
                    // data-preserving default.
                    if (archiveReminder.updatedAt >= local.updatedAt) {
                        remindersToUpdate += archiveReminder
                        scheduleRulesToApply[archiveReminder.id] = rule
                    }
                }
            }
        }

        return BackupMergePlan(
            conflicts = conflicts,
            remindersToInsert = remindersToInsert,
            remindersToUpdate = remindersToUpdate,
            scheduleRulesToApply = scheduleRulesToApply,
            profilesToInsert = profilesToInsert,
            skippedBuiltInProfileIds = skippedBuiltIn,
        )
    }

    private fun isSameProfile(a: ReminderProfileEntity, b: ReminderProfileEntity): Boolean =
        a.nameKey == b.nameKey &&
            a.fullScreenWhenLocked == b.fullScreenWhenLocked &&
            a.timeoutSeconds == b.timeoutSeconds &&
            a.retryCount == b.retryCount &&
            a.graceSeconds == b.graceSeconds &&
            a.defaultSnoozeMinutes == b.defaultSnoozeMinutes

    private fun isSameReminder(a: ReminderEntity, b: ReminderEntity): Boolean =
        a.label == b.label &&
            a.notes == b.notes &&
            a.mediaId == b.mediaId &&
            a.profileId == b.profileId &&
            a.enabledIntent == b.enabledIntent &&
            a.snoozeDefaultMinutes == b.snoozeDefaultMinutes &&
            a.snoozeAllowCustom == b.snoozeAllowCustom &&
            a.snoozeMinimumMinutes == b.snoozeMinimumMinutes &&
            a.snoozeMaximumMinutes == b.snoozeMaximumMinutes
}
