package com.aslam.mediareminder.alarm

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * JVM unit tests for [DevicePresentationState] — MR-06 "Adaptive
 * presentation decision"'s five rules, plus the edge cases their combination
 * implies. No Android dependency; runs on the plain JVM.
 */
class DevicePresentationStateTest {

    // --- Rule 1: locked, profile permits, notifications usable, FSI eligible ---

    @Test
    fun `locked with eligible full-screen intent uses full-screen`() {
        val decision = DevicePresentationState.classify(
            isLockedOrNonInteractive = true,
            profilePermitsLockedAlarm = true,
            notificationsUsable = true,
            fullScreenIntentEligible = true,
        )
        assertEquals(DevicePresentationState.Decision(useFullScreenIntent = true, fullScreenIntentLimited = false, allowInAppForegroundEvent = false), decision)
    }

    // --- Rule 2: locked, profile permits, notifications usable, FSI NOT eligible ---

    @Test
    fun `locked with ineligible full-screen intent falls back to Limited FSI notification`() {
        val decision = DevicePresentationState.classify(
            isLockedOrNonInteractive = true,
            profilePermitsLockedAlarm = true,
            notificationsUsable = true,
            fullScreenIntentEligible = false,
        )
        assertEquals(DevicePresentationState.Decision(useFullScreenIntent = false, fullScreenIntentLimited = true, allowInAppForegroundEvent = false), decision)
    }

    // --- Rule 3: unlocked/interactive never launches full-screen, regardless of other inputs ---

    @Test
    fun `unlocked never uses full-screen even when everything else would allow it`() {
        val decision = DevicePresentationState.classify(
            isLockedOrNonInteractive = false,
            profilePermitsLockedAlarm = true,
            notificationsUsable = true,
            fullScreenIntentEligible = true,
        )
        assertEquals(false, decision.useFullScreenIntent)
        assertEquals(false, decision.fullScreenIntentLimited)
    }

    @Test
    fun `unlocked allows the in-app foreground event`() {
        val decision = DevicePresentationState.classify(
            isLockedOrNonInteractive = false,
            profilePermitsLockedAlarm = true,
            notificationsUsable = true,
            fullScreenIntentEligible = true,
        )
        assertEquals(true, decision.allowInAppForegroundEvent)
    }

    @Test
    fun `unlocked with a Gentle profile still allows the in-app foreground event`() {
        // The in-app event is about lock state, not profile — a Gentle
        // reminder due while the app is open still deserves the compact
        // strip; profile only ever gates the locked/full-screen surface.
        val decision = DevicePresentationState.classify(
            isLockedOrNonInteractive = false,
            profilePermitsLockedAlarm = false,
            notificationsUsable = true,
            fullScreenIntentEligible = false,
        )
        assertEquals(true, decision.allowInAppForegroundEvent)
    }

    // --- Locked but the profile itself doesn't want a locked takeover (Gentle) ---

    @Test
    fun `locked with a Gentle profile never uses full-screen and never emits the in-app event`() {
        val decision = DevicePresentationState.classify(
            isLockedOrNonInteractive = true,
            profilePermitsLockedAlarm = false,
            notificationsUsable = true,
            fullScreenIntentEligible = true,
        )
        assertEquals(DevicePresentationState.Decision(useFullScreenIntent = false, fullScreenIntentLimited = false, allowInAppForegroundEvent = false), decision)
    }

    // --- Rule 5: uncertain (notifications not usable) falls back to the safe unlocked-shaped path ---

    @Test
    fun `locked with notifications unusable falls back to the safe path, not Limited FSI`() {
        val decision = DevicePresentationState.classify(
            isLockedOrNonInteractive = true,
            profilePermitsLockedAlarm = true,
            notificationsUsable = false,
            fullScreenIntentEligible = true,
        )
        assertEquals(DevicePresentationState.Decision(useFullScreenIntent = false, fullScreenIntentLimited = false, allowInAppForegroundEvent = false), decision)
    }

    // --- A locked device never emits the in-app event, no matter how permissive everything else is ---

    @Test
    fun `locked never allows the in-app foreground event`() {
        val decision = DevicePresentationState.classify(
            isLockedOrNonInteractive = true,
            profilePermitsLockedAlarm = true,
            notificationsUsable = true,
            fullScreenIntentEligible = true,
        )
        assertEquals(false, decision.allowInAppForegroundEvent)
    }
}
