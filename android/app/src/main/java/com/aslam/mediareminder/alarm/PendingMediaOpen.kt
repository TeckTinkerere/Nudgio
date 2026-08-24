package com.aslam.mediareminder.alarm

/**
 * One-slot handoff for "Accept opened an alarm — show me that media".
 *
 * [AlarmActivity] resolves Accept by broadcasting to [AlarmActionReceiver]
 * and finishing immediately (see its doc), so there is no Activity result to
 * carry a payload back on, and the RN bridge may not even be alive yet when
 * Accept is tapped from a locked screen. A process-scoped slot sidesteps
 * both: the alarm side *writes* it and launches `MainActivity`, and JS
 * *takes* it (see `takePendingMediaOpen`) once it has actually mounted —
 * whenever that turns out to be. Deliberately not an event emit: an event
 * fired before JS subscribes is simply lost, which is exactly the race a
 * cold launch from the lock screen hits every time.
 *
 * Take-once by construction ([take] clears as it reads), so a later resume
 * — the user backgrounding and returning hours afterwards — does not
 * re-open a player they already dismissed.
 *
 * Not persisted: if the process dies before JS reads it, the request is
 * correctly forgotten rather than resurfacing at the next cold start.
 */
object PendingMediaOpen {

    @Volatile
    private var mediaId: String? = null

    /** Called from the alarm side, immediately before launching `MainActivity`. */
    fun set(id: String?) {
        mediaId = id
    }

    /** Returns the pending id (if any) and clears it, so it is delivered at most once. */
    @Synchronized
    fun take(): String? {
        val current = mediaId
        mediaId = null
        return current
    }
}
