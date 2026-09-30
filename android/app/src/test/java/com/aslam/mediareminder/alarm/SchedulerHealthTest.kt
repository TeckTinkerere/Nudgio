package com.aslam.mediareminder.alarm

import com.aslam.mediareminder.data.db.entity.SchedulerStateEntity
import org.junit.Assert.*
import org.junit.Test

class SchedulerHealthTest {
    private val state = SchedulerStateEntity(desiredOccurrenceId = "due", desiredAt = 5000,
        desiredGeneration = 2, appliedGeneration = 2, pendingIntentRequestCode = 1,
        lastReconcileAt = 1000, lastReason = "test")

    @Test fun absentStateIsUnknownRatherThanReady() {
        assertEquals("unknown", SchedulerHealth.classify(null).first)
    }
    @Test fun unacknowledgedGenerationOrErrorIsNotReady() {
        assertEquals("limited", SchedulerHealth.classify(state.copy(appliedGeneration = 1)).first)
        assertEquals("limited", SchedulerHealth.classify(state.copy(lastErrorCode = "failed")).first)
    }
    @Test fun idleDoesNotClaimThereIsANextAlarm() {
        assertEquals("capability.scheduler.idle", SchedulerHealth.classify(state.copy(desiredOccurrenceId = null, desiredAt = null)).second)
    }
    @Test fun registeredInexactAlarmIsLimited() {
        assertEquals("limited", SchedulerHealth.classify(state.copy(isExact = false)).first)
        assertEquals("ready", SchedulerHealth.classify(state).first)
    }
}
