package com.aslam.mediareminder.alarm

import android.content.Context

/**
 * ADR-017: "A minimal next-alarm envelope containing no media path or
 * sensitive label is mirrored into device-protected storage." This is that
 * envelope — exactly one piece of real information (the next due instant)
 * plus a generation counter for staleness, mirrored by [SchedulerCoordinator]
 * every time it applies or clears the `AlarmManager` registration.
 *
 * Deliberately NOT the reminder id, occurrence id or label: Room lives in
 * credential-protected storage and is unreadable before first unlock, so
 * this store must never need — or leak — anything Room-shaped. It exists
 * only so [SystemEventReceiver] can "reschedule a generic due alert" before
 * first unlock after reboot, per MR-06 "Reboot and direct boot".
 */
object DirectBootEnvelopeStore {
    private const val PREFS_NAME = "direct_boot_envelope"
    private const val KEY_DUE_AT = "due_at_epoch_ms"
    private const val KEY_GENERATION = "generation"

    data class Envelope(val dueAtEpochMs: Long, val generation: Long)

    /**
     * Device-protected storage is readable before first unlock (unlike the
     * app's default, credential-protected storage where Room's database file
     * lives) — that split is the entire reason this store exists separately
     * from `scheduler_state`.
     */
    private fun prefs(context: Context) =
        context.createDeviceProtectedStorageContext()
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun write(context: Context, dueAtEpochMs: Long, generation: Long) {
        prefs(context).edit()
            .putLong(KEY_DUE_AT, dueAtEpochMs)
            .putLong(KEY_GENERATION, generation)
            .apply()
    }

    fun clear(context: Context) {
        prefs(context).edit().clear().apply()
    }

    fun read(context: Context): Envelope? {
        val stored = prefs(context)
        if (!stored.contains(KEY_DUE_AT)) return null
        return Envelope(
            dueAtEpochMs = stored.getLong(KEY_DUE_AT, 0L),
            generation = stored.getLong(KEY_GENERATION, 0L),
        )
    }
}
