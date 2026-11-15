package com.aslam.mediareminder.profiles

import com.aslam.mediareminder.data.db.entity.ReminderProfileEntity
import com.aslam.mediareminder.profiles.ProfileRules.DeleteCheck
import com.aslam.mediareminder.profiles.ProfileRules.SavePlan
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** FUN-008 / DL-123. Mirrored by `test/features/profile_rules_test.dart`: the two must agree. */
class ProfileRulesTest {

    private val standard = ReminderProfileEntity(
        id = ReminderProfileEntity.STANDARD_ID,
        nameKey = "profile.standard.name",
        isBuiltIn = true,
        fullScreenWhenLocked = true,
        timeoutSeconds = 300,
        retryCount = 1,
        graceSeconds = 600,
        defaultSnoozeMinutes = 10,
        createdAt = 1,
        updatedAt = 1,
    )
    private val gentle = standard.copy(
        id = ReminderProfileEntity.GENTLE_ID,
        nameKey = "profile.gentle.name",
        fullScreenWhenLocked = false,
        timeoutSeconds = 60,
        retryCount = 0,
        graceSeconds = 300,
    )
    private val morning = standard.copy(id = "custom-1", nameKey = "Morning", isBuiltIn = false, entityVersion = 4)
    private val all = listOf(gentle, standard, morning)

    private fun input(
        id: String? = null,
        name: String? = "Medication",
        fullScreenWhenLocked: Boolean? = true,
        timeoutSeconds: Int? = 120,
        retryCount: Int? = 2,
        graceSeconds: Int? = 300,
        defaultSnoozeMinutes: Int? = 15,
        expectedEntityVersion: Int? = null,
    ) = ProfileRules.Input(
        id, name, fullScreenWhenLocked, timeoutSeconds, retryCount, graceSeconds, defaultSnoozeMinutes,
        expectedEntityVersion,
    )

    private fun plan(input: ProfileRules.Input, existing: ReminderProfileEntity? = null, profiles: List<ReminderProfileEntity> = all) =
        ProfileRules.planSave(input, existing, profiles, newId = "new-id", nowMs = 5000)

    @Test fun aNewProfileIsInsertedAsCustomWithTheGivenValues() {
        val result = plan(input(name = "  Medication   time ")) as SavePlan.Insert
        assertEquals(
            ReminderProfileEntity(
                id = "new-id", nameKey = "Medication time", isBuiltIn = false, fullScreenWhenLocked = true,
                timeoutSeconds = 120, retryCount = 2, graceSeconds = 300, defaultSnoozeMinutes = 15,
                createdAt = 5000, updatedAt = 5000,
            ),
            result.profile,
        )
    }

    @Test fun everyBoundIsInclusiveAndOneStepOutsideIsRefused() {
        assertTrue(plan(input(timeoutSeconds = 15, retryCount = 0, graceSeconds = 60, defaultSnoozeMinutes = 1)) is SavePlan.Insert)
        assertTrue(plan(input(timeoutSeconds = 600, retryCount = 3, graceSeconds = 3600, defaultSnoozeMinutes = 120)) is SavePlan.Insert)
        assertEquals(SavePlan.Invalid("timeoutSeconds"), plan(input(timeoutSeconds = 14)))
        assertEquals(SavePlan.Invalid("timeoutSeconds"), plan(input(timeoutSeconds = 601)))
        assertEquals(SavePlan.Invalid("retryCount"), plan(input(retryCount = -1)))
        assertEquals(SavePlan.Invalid("retryCount"), plan(input(retryCount = 4)))
        assertEquals(SavePlan.Invalid("graceSeconds"), plan(input(graceSeconds = 59)))
        assertEquals(SavePlan.Invalid("graceSeconds"), plan(input(graceSeconds = 3601)))
        assertEquals(SavePlan.Invalid("defaultSnoozeMinutes"), plan(input(defaultSnoozeMinutes = 0)))
        assertEquals(SavePlan.Invalid("defaultSnoozeMinutes"), plan(input(defaultSnoozeMinutes = 121)))
    }

    @Test fun aMissingFieldIsNamedNotThrown() {
        assertEquals(SavePlan.Invalid("timeoutSeconds"), plan(input(timeoutSeconds = null)))
        assertEquals(SavePlan.Invalid("retryCount"), plan(input(retryCount = null)))
        assertEquals(SavePlan.Invalid("graceSeconds"), plan(input(graceSeconds = null)))
        assertEquals(SavePlan.Invalid("defaultSnoozeMinutes"), plan(input(defaultSnoozeMinutes = null)))
        assertEquals(SavePlan.Invalid("name"), plan(input(name = null)))
        assertEquals(SavePlan.Invalid("fullScreenWhenLocked"), plan(input(fullScreenWhenLocked = null)))
    }

    @Test fun namesAreCleanedAndBadOnesRefused() {
        assertEquals("Night shift", ProfileRules.cleanName("  Night \t shift "))
        assertEquals("a".repeat(40), ProfileRules.cleanName("a".repeat(40)))
        assertNull(ProfileRules.cleanName("a".repeat(41)))
        assertNull(ProfileRules.cleanName("   "))
        assertNull(ProfileRules.cleanName(null))
        assertNull(ProfileRules.cleanName("bad\u0007name"))
        // Would be read as a built-in's localization key.
        assertNull(ProfileRules.cleanName("profile.gentle.name"))
        assertNull(ProfileRules.cleanName("Profile.mine"))
    }

    @Test fun aNameAnotherCustomProfileHasIsRefusedWhateverTheCase() {
        assertEquals(SavePlan.Invalid("name"), plan(input(name = "morning")))
        // Keeping its own name while editing is not a clash.
        assertTrue(plan(input(id = morning.id, name = "MORNING"), existing = morning) is SavePlan.Update)
    }

    @Test fun editingACustomProfileKeepsItsIdentityAndBumpsTheVersion() {
        val result = plan(input(id = morning.id, name = "Evening", fullScreenWhenLocked = false), existing = morning) as SavePlan.Update
        assertEquals(
            morning.copy(
                nameKey = "Evening", fullScreenWhenLocked = false, timeoutSeconds = 120, retryCount = 2,
                graceSeconds = 300, defaultSnoozeMinutes = 15, updatedAt = 5000, entityVersion = 5,
            ),
            result.profile,
        )
    }

    @Test fun aBuiltInTakesNewNumbersButKeepsItsNameAndWhetherItRings() {
        val result = plan(
            input(id = gentle.id, name = "Loud", fullScreenWhenLocked = true, timeoutSeconds = 90),
            existing = gentle,
        ) as SavePlan.Update
        assertEquals("profile.gentle.name", result.profile.nameKey)
        assertEquals(false, result.profile.fullScreenWhenLocked)
        assertTrue(result.profile.isBuiltIn)
        assertEquals(90, result.profile.timeoutSeconds)
        assertEquals(2, result.profile.entityVersion)
    }

    @Test fun aBuiltInNeedsNoNameOrRingingField() {
        assertTrue(plan(input(id = gentle.id, name = null, fullScreenWhenLocked = null), existing = gentle) is SavePlan.Update)
    }

    @Test fun aStaleVersionIsAConflictAndAMatchingOneIsNot() {
        assertEquals(SavePlan.Conflict, plan(input(id = morning.id, expectedEntityVersion = 3), existing = morning))
        assertTrue(plan(input(id = morning.id, name = "Morning", expectedEntityVersion = 4), existing = morning) is SavePlan.Update)
    }

    @Test fun anIdThatMatchesNothingIsNotFoundNeverACreate() {
        assertEquals(SavePlan.NotFound, plan(input(id = "gone")))
    }

    @Test fun theTwentyFirstCustomProfileIsRefusedButEditingAtTheLimitIsNot() {
        val twenty = (1..20).map { morning.copy(id = "c$it", nameKey = "Custom $it") }
        assertEquals(SavePlan.Invalid("limit"), plan(input(), profiles = listOf(gentle, standard) + twenty))
        assertTrue(plan(input(id = "c1", name = "Renamed"), existing = twenty[0], profiles = listOf(gentle) + twenty) is SavePlan.Update)
        assertTrue(plan(input(), profiles = listOf(gentle, standard) + twenty.take(19)) is SavePlan.Insert)
    }

    @Test fun resetPutsABuiltInBackToItsSeed() {
        val edited = standard.copy(timeoutSeconds = 30, retryCount = 3, graceSeconds = 60, defaultSnoozeMinutes = 1, entityVersion = 7)
        assertEquals(standard.copy(updatedAt = 9000, entityVersion = 8), ProfileRules.planReset(edited, nowMs = 9000))
    }

    @Test fun resetRefusesACustomOrMissingProfile() {
        assertNull(ProfileRules.planReset(morning, nowMs = 9000))
        assertNull(ProfileRules.planReset(null, nowMs = 9000))
    }

    @Test fun deleteIsOnlyForAnUnusedCustomProfile() {
        assertEquals(DeleteCheck.ALLOWED, ProfileRules.checkDelete(morning, reminderCount = 0))
        assertEquals(DeleteCheck.IN_USE, ProfileRules.checkDelete(morning, reminderCount = 1))
        assertEquals(DeleteCheck.BUILT_IN, ProfileRules.checkDelete(gentle, reminderCount = 0))
        assertEquals(DeleteCheck.NOT_FOUND, ProfileRules.checkDelete(null, reminderCount = 0))
    }
}
