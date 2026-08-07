package com.aslam.mediareminder.alarm

/**
 * MR-06 "Adaptive presentation decision", step 6 of the nine-step dispatch
 * algorithm ("calculate device presentation state"). Pure and
 * JVM-testable — same shape as [OccurrenceCalculator] — so the five decision
 * rules can be verified without a device, and so [AlarmDispatchReceiver]
 * itself stays a thin caller that only gathers the inputs.
 *
 * Deliberately does NOT decide *whether a profile rings* (sound/vibration
 * via `AlarmRingingService`) — that is profile-driven
 * ([com.aslam.mediareminder.data.db.entity.ReminderProfileEntity.fullScreenWhenLocked],
 * true for Standard/Persistent, false for Gentle) and independent of lock
 * state: a Standard/Persistent reminder rings whether the phone is locked or
 * in the user's hand, matching MR-06's "CATEGORY_ALARM for Standard/
 * Persistent... CATEGORY_REMINDER for Gentle." This classifier only decides
 * *which UI surface* presents that ringing (or, for Gentle, the one-shot
 * notification).
 */
object DevicePresentationState {

    /**
     * @param useFullScreenIntent Rule 1: attach `setFullScreenIntent()` to
     *   the notification, launching [AlarmActivity] over the keyguard.
     * @param fullScreenIntentLimited Rule 2: locked/non-interactive and the
     *   profile wants a locked alarm, but full-screen intent itself is not
     *   eligible (API 34+ `canUseFullScreenIntent()` denied, or
     *   notifications are blocked) — the same notification as
     *   [useFullScreenIntent]`= false`, but recorded as a distinct capability
     *   state (`full_screen_intent: limited`) rather than silently identical
     *   to the plain unlocked case.
     * @param allowInAppForegroundEvent Rule 3/4: the device is unlocked and
     *   interactive, so [AlarmActivity] must never be launched directly, and
     *   emitting the in-app-strip event is *safe* to consider — the caller
     *   still gates the actual emission on whether the app itself is
     *   foreground (this classifier has no way to know that; it only rules
     *   out emitting while locked, since MR-06's in-app strip is meaningless
     *   over a locked screen).
     */
    data class Decision(
        val useFullScreenIntent: Boolean,
        val fullScreenIntentLimited: Boolean,
        val allowInAppForegroundEvent: Boolean,
    )

    /**
     * @param isLockedOrNonInteractive `KeyguardManager.isKeyguardLocked() || !PowerManager.isInteractive()`.
     * @param profilePermitsLockedAlarm the reminder's profile
     *   (`fullScreenWhenLocked`) opts into the locked/full-screen alarm
     *   surface at all.
     * @param notificationsUsable runtime notification permission granted and
     *   the channel is not blocked (MR-06 capability matrix's "Notifications"
     *   row) — rule 1 requires this alongside FSI eligibility.
     * @param fullScreenIntentEligible platform-level eligibility: below
     *   API 34 this is always true once the manifest permission is declared;
     *   API 34+ additionally requires `NotificationManager.canUseFullScreenIntent()`.
     */
    fun classify(
        isLockedOrNonInteractive: Boolean,
        profilePermitsLockedAlarm: Boolean,
        notificationsUsable: Boolean,
        fullScreenIntentEligible: Boolean,
    ): Decision {
        // Rule 5: "If state is uncertain, choose the unlocked notification
        // path" — folded in here as "anything that isn't affirmatively
        // locked-and-eligible falls through to the safe default."
        if (!isLockedOrNonInteractive) {
            return Decision(useFullScreenIntent = false, fullScreenIntentLimited = false, allowInAppForegroundEvent = true)
        }
        if (!profilePermitsLockedAlarm || !notificationsUsable) {
            // Locked, but this reminder's profile doesn't want a locked
            // takeover (Gentle) or notifications aren't usable at all —
            // same notification-only shape as the unlocked path; no in-app
            // event, since the app cannot be meaningfully foreground behind
            // a locked screen.
            return Decision(useFullScreenIntent = false, fullScreenIntentLimited = false, allowInAppForegroundEvent = false)
        }
        return if (fullScreenIntentEligible) {
            Decision(useFullScreenIntent = true, fullScreenIntentLimited = false, allowInAppForegroundEvent = false)
        } else {
            Decision(useFullScreenIntent = false, fullScreenIntentLimited = true, allowInAppForegroundEvent = false)
        }
    }
}
