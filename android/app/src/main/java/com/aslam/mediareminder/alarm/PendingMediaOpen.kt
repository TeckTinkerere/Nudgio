package com.aslam.mediareminder.alarm

/**
 * One-slot handoff for "Play opened an alarm — show me that reminder".
 *
 * Play is resolved natively (see [AlarmActionReceiver]) and the app is
 * launched separately, so there is no Activity result to carry a payload
 * back on, and the RN bridge may not even be alive yet when Play is tapped
 * from a locked screen. A process-scoped slot sidesteps both: the alarm side
 * *writes* it and launches `MainActivity`, and JS *takes* it (see
 * `takePendingMediaOpen`) once it has actually mounted — whenever that turns
 * out to be. Deliberately not an event emit: an event fired before JS
 * subscribes is simply lost, which is exactly the race a cold launch from
 * the lock screen hits every time.
 *
 * Carries the reminder (DL-080), not just its media: what opens is the
 * reminder's moment — title, message, media and its "what next" action —
 * not a bare media viewer. `mediaId` is kept alongside as the fallback if
 * the reminder itself is gone by the time JS reads it.
 *
 * Take-once by construction ([take] clears as it reads), so a later resume
 * — the user backgrounding and returning hours afterwards — does not
 * re-open a moment they already closed.
 *
 * Not persisted: if the process dies before JS reads it, the request is
 * correctly forgotten rather than resurfacing at the next cold start.
 */
object PendingMediaOpen {

    data class Request(val reminderId: String?, val mediaId: String?)

    @Volatile
    private var request: Request? = null

    /** Called from the alarm side, immediately before launching `MainActivity`. */
    fun set(reminderId: String?, mediaId: String?) {
        request = if (reminderId == null && mediaId == null) null else Request(reminderId, mediaId)
    }

    /** Returns the pending request (if any) and clears it, so it is delivered at most once. */
    @Synchronized
    fun take(): Request? {
        val current = request
        request = null
        return current
    }
}
