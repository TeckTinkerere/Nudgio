package com.aslam.mediareminder.alarm

import com.aslam.mediareminder.data.db.entity.SchedulerStateEntity

/** Reports the persisted outbox acknowledgement, never an unconditional Ready. */
object SchedulerHealth {
    fun classify(state: SchedulerStateEntity?): Pair<String, String> = when {
        state == null -> "unknown" to "capability.scheduler.unknown"
        state.lastErrorCode != null || state.desiredGeneration != state.appliedGeneration ->
            "limited" to "capability.scheduler.pending"
        state.desiredOccurrenceId == null -> "ready" to "capability.scheduler.idle"
        !state.isExact -> "limited" to "capability.scheduler.inexact"
        else -> "ready" to "capability.scheduler.ready"
    }
}
