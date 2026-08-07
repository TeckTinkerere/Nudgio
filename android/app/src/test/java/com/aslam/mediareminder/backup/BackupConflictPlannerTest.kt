package com.aslam.mediareminder.backup

import com.aslam.mediareminder.alarm.ScheduleRule
import com.aslam.mediareminder.data.db.entity.ReminderEntity
import com.aslam.mediareminder.data.db.entity.ReminderProfileEntity
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalTime

/**
 * JVM unit tests for [BackupConflictPlanner] — MR-10 "Merge" default
 * resolution rules. No Android dependency (Room entities here are plain
 * data classes); runs on the plain JVM.
 */
class BackupConflictPlannerTest {

    private fun profile(id: String, nameKey: String = "profile.custom.name", updatedAt: Long = 0L) =
        ReminderProfileEntity(
            id = id,
            nameKey = nameKey,
            isBuiltIn = false,
            fullScreenWhenLocked = true,
            timeoutSeconds = 60,
            retryCount = 0,
            graceSeconds = 300,
            defaultSnoozeMinutes = 10,
            createdAt = 0L,
            updatedAt = updatedAt,
        )

    private fun reminder(id: String, label: String = "Take pills", updatedAt: Long = 0L, profileId: String = "profile-1") =
        ReminderEntity(
            id = id,
            mediaId = "media-1",
            profileId = profileId,
            label = label,
            notes = null,
            enabledIntent = true,
            effectiveState = ReminderEntity.STATE_ACTIVE,
            snoozeDefaultMinutes = 10,
            snoozeAllowCustom = false,
            snoozeMinimumMinutes = 5,
            snoozeMaximumMinutes = 30,
            historyEnabled = true,
            createdAt = 0L,
            updatedAt = updatedAt,
        )

    private fun validatedBackup(
        profiles: List<ReminderProfileEntity> = emptyList(),
        reminders: List<ReminderEntity> = emptyList(),
        scheduleRules: Map<String, ScheduleRule> = emptyMap(),
    ) = ValidatedBackup(
        manifest = BackupManifest(
            format = BackupFormat.FORMAT_ID,
            archiveVersion = BackupFormat.ARCHIVE_VERSION,
            createdAt = "2026-01-01T00:00:00Z",
            sourceAppVersion = "0.1.0",
            sourceSchemaVersion = 3,
            minimumReaderArchiveVersion = BackupFormat.MINIMUM_READER_ARCHIVE_VERSION,
            exportId = "33333333-3333-4333-8333-333333333333",
            scope = BackupFormat.SCOPE_ALL,
            includesHistory = false,
            counts = BackupManifest.Counts(0, reminders.size, profiles.size, 0, 0),
            totalMediaBytes = "0",
            hashAlgorithm = BackupFormat.HASH_ALGORITHM,
            recordsEncoding = BackupFormat.RECORDS_ENCODING,
            privacy = BackupFormat.PRIVACY_LABEL,
        ),
        profiles = profiles,
        reminders = reminders,
        scheduleRules = scheduleRules,
        settings = null,
        compatibility = "compatible",
        checksumStatus = "valid",
        warnings = emptyList(),
        compressedBytes = 0,
        expectedUncompressedBytes = 0,
    )

    private val rule = ScheduleRule.Daily(LocalTime.of(8, 0))

    @Test
    fun `a new reminder not present locally is inserted`() {
        val archiveReminder = reminder("r1")
        val plan = BackupConflictPlanner.planMerge(
            archive = validatedBackup(reminders = listOf(archiveReminder), scheduleRules = mapOf("r1" to rule)),
            localProfiles = emptyList(),
            localReminders = emptyList(),
        )

        assertEquals(listOf(archiveReminder), plan.remindersToInsert)
        assertTrue(plan.remindersToUpdate.isEmpty())
        assertTrue(plan.conflicts.isEmpty())
        assertEquals(rule, plan.scheduleRulesToApply["r1"])
    }

    @Test
    fun `an identical reminder already present locally is a silent no-op`() {
        val shared = reminder("r1")
        val plan = BackupConflictPlanner.planMerge(
            archive = validatedBackup(reminders = listOf(shared), scheduleRules = mapOf("r1" to rule)),
            localProfiles = emptyList(),
            localReminders = listOf(shared),
        )

        assertTrue(plan.remindersToInsert.isEmpty())
        assertTrue(plan.remindersToUpdate.isEmpty())
        assertTrue(plan.conflicts.isEmpty())
    }

    @Test
    fun `a same-id reminder with different content conflicts and the newer copy wins`() {
        val local = reminder("r1", label = "Local label", updatedAt = 1000L)
        val archive = reminder("r1", label = "Archive label", updatedAt = 2000L)

        val plan = BackupConflictPlanner.planMerge(
            archive = validatedBackup(reminders = listOf(archive), scheduleRules = mapOf("r1" to rule)),
            localProfiles = emptyList(),
            localReminders = listOf(local),
        )

        assertEquals(1, plan.conflicts.size)
        assertEquals("reminder", plan.conflicts[0].kind)
        assertEquals(listOf(archive), plan.remindersToUpdate)
        assertEquals(rule, plan.scheduleRulesToApply["r1"])
    }

    @Test
    fun `a same-id reminder conflict keeps local when the local copy is newer`() {
        val local = reminder("r1", label = "Local label", updatedAt = 5000L)
        val archive = reminder("r1", label = "Archive label", updatedAt = 1000L)

        val plan = BackupConflictPlanner.planMerge(
            archive = validatedBackup(reminders = listOf(archive), scheduleRules = mapOf("r1" to rule)),
            localProfiles = emptyList(),
            localReminders = listOf(local),
        )

        assertEquals(1, plan.conflicts.size)
        assertTrue(plan.remindersToUpdate.isEmpty())
        assertTrue(plan.scheduleRulesToApply.isEmpty())
    }

    @Test
    fun `a reminder with no matching schedule rule is skipped entirely`() {
        val plan = BackupConflictPlanner.planMerge(
            archive = validatedBackup(reminders = listOf(reminder("r1")), scheduleRules = emptyMap()),
            localProfiles = emptyList(),
            localReminders = emptyList(),
        )

        assertTrue(plan.remindersToInsert.isEmpty())
        assertTrue(plan.scheduleRulesToApply.isEmpty())
    }

    @Test
    fun `a built-in profile id from the archive is always skipped, never inserted or conflicted`() {
        val archiveGentle = profile(ReminderProfileEntity.GENTLE_ID, nameKey = "profile.gentle.name.customized")

        val plan = BackupConflictPlanner.planMerge(
            archive = validatedBackup(profiles = listOf(archiveGentle)),
            localProfiles = emptyList(),
            localReminders = emptyList(),
        )

        assertEquals(listOf(ReminderProfileEntity.GENTLE_ID), plan.skippedBuiltInProfileIds)
        assertTrue(plan.profilesToInsert.isEmpty())
        assertTrue(plan.conflicts.isEmpty())
    }

    @Test
    fun `a new custom profile not present locally is inserted`() {
        val archiveProfile = profile("custom-1")

        val plan = BackupConflictPlanner.planMerge(
            archive = validatedBackup(profiles = listOf(archiveProfile)),
            localProfiles = emptyList(),
            localReminders = emptyList(),
        )

        assertEquals(listOf(archiveProfile), plan.profilesToInsert)
    }

    @Test
    fun `a same-id custom profile with different content conflicts and keeps local by default`() {
        val local = profile("custom-1", nameKey = "profile.local")
        val archive = profile("custom-1", nameKey = "profile.archive")

        val plan = BackupConflictPlanner.planMerge(
            archive = validatedBackup(profiles = listOf(archive)),
            localProfiles = listOf(local),
            localReminders = emptyList(),
        )

        assertEquals(1, plan.conflicts.size)
        assertEquals("profile", plan.conflicts[0].kind)
        assertEquals("keep_local", plan.conflicts[0].recommendedAction)
        assertTrue(plan.profilesToInsert.isEmpty())
    }
}
