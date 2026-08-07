package com.aslam.mediareminder.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.os.PowerManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Shared MR-06/MR-18 pattern for a manifest [BroadcastReceiver] that must do
 * Room/suspend work off the main thread: acquire a bounded wake lock (the
 * documented defense against OEM power-management deviations — `AlarmManager`/
 * broadcast delivery itself already covers stock AOSP for the `goAsync()`
 * window), call `goAsync()`, run [block] on a bounded IO-scoped coroutine, and
 * release/finish in `finally` regardless of outcome.
 *
 * [AlarmDispatchReceiver] and [AlarmActionReceiver] both had this exact shape
 * duplicated before it was extracted here (docs/decision-log.md).
 * [SystemEventReceiver] deliberately does *not* use this — its boot/clock-
 * change handlers have no wake lock (BOOT_COMPLETED/TIME_SET delivery is
 * already wake-guaranteed) and a differently-shaped fail-safe fallback, so
 * forcing it through this same helper would be a worse fit, not a real
 * dedup.
 */
internal fun BroadcastReceiver.dispatchWithWakeLock(
    context: Context,
    wakeLockTag: String,
    wakeLockTimeoutMs: Long,
    onFailure: suspend (Throwable) -> Unit,
    block: suspend () -> Unit,
) {
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    val wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, wakeLockTag)
    wakeLock.acquire(wakeLockTimeoutMs)

    val pendingResult = goAsync()
    CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
        try {
            block()
        } catch (error: Throwable) {
            onFailure(error)
        } finally {
            if (wakeLock.isHeld) wakeLock.release()
            pendingResult.finish()
        }
    }
}
