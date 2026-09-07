package com.aslam.mediareminder.capability

import android.content.Context
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationManagerCompat
import com.aslam.mediareminder.alarm.ExactAlarmAccess
import com.aslam.mediareminder.alarm.FullScreenIntentAccess
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableArray
import com.facebook.react.bridge.WritableMap
import java.time.Instant

/**
 * Produces the MR-08 `CapabilitySnapshot` / MR-06 "Capability state machine".
 *
 * `notifications`, `exact_alarm`, `full_screen_intent` and
 * `battery_environment` are real, observed platform queries. `channels`
 * remains unreported — no per-channel Settings surface exists to deep-link
 * to yet. `scheduler` is still a placeholder pending task #20's boot/
 * timezone reconciliation work, which is what makes that row meaningfully
 * "Limited" vs "Ready".
 */
object CapabilitySnapshotProvider {

    private fun capabilityItem(
        kind: String,
        status: String,
        effectKey: String,
        action: String,
    ): WritableMap = Arguments.createMap().apply {
        putString("kind", kind)
        putString("status", status)
        putString("effectKey", effectKey)
        putString("action", action)
        putString("observedAt", Instant.now().toString())
    }

    private fun notificationsStatus(context: Context): Pair<String, String> {
        val enabled = NotificationManagerCompat.from(context).areNotificationsEnabled()
        return if (enabled) {
            "ready" to "capability.notifications.ready"
        } else {
            "blocked" to "capability.notifications.blocked"
        }
    }

    /**
     * MR-06 capability matrix: Ready = `canScheduleExactAlarms()` true,
     * Limited = "user selected inexact Limited mode", Blocked = "access
     * false and user declined Limited mode." There is no explicit-decline
     * consent UI in this pass (see [com.aslam.mediareminder.alarm.SchedulerCoordinator]'s
     * scope note) — [SchedulerCoordinator] always falls back to
     * `setAndAllowWhileIdle()` transparently rather than leaving a reminder
     * unscheduled, so "access false" here always means the observed state is
     * Limited, never the unreachable-without-a-decline-flow Blocked.
     */
    private fun exactAlarmStatus(context: Context): Pair<String, String> {
        return if (ExactAlarmAccess.isAvailable(context)) {
            "ready" to "capability.exactAlarm.ready"
        } else {
            "limited" to "capability.exactAlarm.limited"
        }
    }

    /**
     * MR-06 "Adaptive presentation decision" rule 1 depends on this: without
     * it, `AlarmDispatchReceiver` silently falls back to a heads-up
     * notification instead of the full-screen alarm surface, on API 34+
     * where the OS treats this as revocable special access rather than a
     * manifest-granted permission. Below API 34 there is no runtime gate at
     * all, so this always reports Ready there.
     */
    private fun fullScreenIntentStatus(context: Context): Pair<String, String> {
        return if (FullScreenIntentAccess.isAvailable(context)) {
            "ready" to "capability.fullScreenIntent.ready"
        } else {
            "limited" to "capability.fullScreenIntent.limited"
        }
    }

    /**
     * Report-only, per MR-06 "No battery optimization exemption request is
     * part of onboarding": this reads [PowerManager.isIgnoringBatteryOptimizations]
     * purely to inform Health, and the returned [CapabilityAction] is always
     * `none` — there is deliberately no `open_special_access` affordance
     * here, unlike `exact_alarm`, so this can never be mistaken for an
     * exemption prompt.
     */
    private fun batteryEnvironmentStatus(context: Context): Pair<String, String> {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return "ready" to "capability.batteryEnvironment.ready"
        }
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
            ?: return "unknown" to "capability.batteryEnvironment.unknown"
        return if (powerManager.isIgnoringBatteryOptimizations(context.packageName)) {
            "ready" to "capability.batteryEnvironment.ready"
        } else {
            // The expected state for most users, since the app never asks to
            // be exempted — this is informational, not a problem to fix.
            "limited" to "capability.batteryEnvironment.limited"
        }
    }

    fun snapshot(context: Context): WritableMap {
        val (notificationStatus, notificationEffectKey) = notificationsStatus(context)
        val (exactAlarmStatus, exactAlarmEffectKey) = exactAlarmStatus(context)
        val (fullScreenIntentStatus, fullScreenIntentEffectKey) = fullScreenIntentStatus(context)
        val (batteryStatus, batteryEffectKey) = batteryEnvironmentStatus(context)

        val items: WritableArray = Arguments.createArray().apply {
            pushMap(
                capabilityItem(
                    kind = "notifications",
                    status = notificationStatus,
                    effectKey = notificationEffectKey,
                    action = if (notificationStatus == "ready") "none" else "request_runtime",
                ),
            )
            pushMap(
                capabilityItem(
                    kind = "exact_alarm",
                    status = exactAlarmStatus,
                    effectKey = exactAlarmEffectKey,
                    action = if (exactAlarmStatus == "ready") "none" else "open_special_access",
                ),
            )
            pushMap(
                capabilityItem(
                    kind = "full_screen_intent",
                    status = fullScreenIntentStatus,
                    effectKey = fullScreenIntentEffectKey,
                    action = if (fullScreenIntentStatus == "ready") "none" else "open_special_access",
                ),
            )
            pushMap(
                capabilityItem(
                    kind = "battery_environment",
                    status = batteryStatus,
                    effectKey = batteryEffectKey,
                    action = "none",
                ),
            )
            // Placeholder until task #20 (SystemEventReceiver) makes
            // "reconciliation pending" a real, observable distinction from
            // "next event persisted and OS alarm registered" (MR-06).
            pushMap(
                capabilityItem(
                    kind = "scheduler",
                    status = "ready",
                    effectKey = "capability.scheduler.ready",
                    action = "none",
                ),
            )
        }

        val overall = if (notificationStatus == "blocked") "needs_action" else "ok"

        return Arguments.createMap().apply {
            putString("overall", overall)
            putArray("items", items)
            putString("observedAt", Instant.now().toString())
        }
    }
}
