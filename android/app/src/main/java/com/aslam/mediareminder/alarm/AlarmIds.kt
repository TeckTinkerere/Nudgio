package com.aslam.mediareminder.alarm

/**
 * Shared identifiers for the single global alarm's `PendingIntent`.
 *
 * MR-06: "Identity is based on a stable scheduler slot, while occurrence
 * identity is authenticated in extras and verified against Room." The
 * request code below is that stable slot — it never changes, because ADR-005
 * guarantees there is only ever one registered alarm. What *can* change
 * between registrations is which occurrence/generation the extras describe,
 * and [AlarmDispatchReceiver] is responsible for checking those extras
 * against the current [com.aslam.mediareminder.data.db.entity.SchedulerStateEntity]
 * row before acting — a stale broadcast for a superseded generation must be
 * a no-op, not a mis-fire.
 */
object AlarmIds {
    /** The one `PendingIntent` request code this app ever registers with `AlarmManager` for due delivery. */
    const val DUE_ALARM_REQUEST_CODE = 1001

    /** A distinct, bounded test alarm (MR-03 "Test reminder") — never competes with [DUE_ALARM_REQUEST_CODE]. */
    const val TEST_ALARM_REQUEST_CODE = 1002

    /** ADR-017's pre-unlock envelope alarm — a third, independent identity so it can never collide with or be cancelled by the other two. */
    const val DIRECT_BOOT_REQUEST_CODE = 1003

    const val ACTION_ALARM_DUE = "com.aslam.mediareminder.action.ALARM_DUE"
    const val ACTION_TEST_ALARM_DUE = "com.aslam.mediareminder.action.TEST_ALARM_DUE"
    const val ACTION_PLAY = "com.aslam.mediareminder.action.PLAY"
    const val ACTION_SNOOZE = "com.aslam.mediareminder.action.SNOOZE"
    const val ACTION_DISMISS = "com.aslam.mediareminder.action.DISMISS"
    const val ACTION_DIRECT_BOOT_ALARM_DUE = "com.aslam.mediareminder.action.DIRECT_BOOT_ALARM_DUE"

    /** [com.aslam.mediareminder.alarm.AlarmRingingService] commands — service-internal, never a manifest-declared broadcast action. */
    const val ACTION_RING = "com.aslam.mediareminder.action.RING"
    const val ACTION_SILENCE = "com.aslam.mediareminder.action.SILENCE"
    const val ACTION_STOP_SESSION = "com.aslam.mediareminder.action.STOP_SESSION"

    const val EXTRA_OCCURRENCE_ID = "occurrence_id"
    const val EXTRA_REMINDER_ID = "reminder_id"
    const val EXTRA_SESSION_ID = "session_id"
    const val EXTRA_GENERATION = "generation"
    const val EXTRA_NONCE = "nonce"
    const val EXTRA_SNOOZE_MINUTES = "snooze_minutes"
}
