package com.aslam.mediareminder.reminders

import com.aslam.mediareminder.data.db.entity.OccurrenceEntity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.time.Instant

/** [com.aslam.mediareminder.alarm.AlarmActionProcessor]'s outcome -> the MR-08 `ActionResult` wire shape. */
object ActionResultWriter {
    fun write(
        sessionId: String,
        outcome: String,
        snoozedUntilEpochMs: Long?,
        nextOccurrence: OccurrenceEntity? = null,
    ): WritableMap = Arguments.createMap().apply {
        putString("sessionId", sessionId)
        putString("outcome", outcome)
        putString("effectiveAt", Instant.now().toString())
        if (snoozedUntilEpochMs != null) putString("snoozedUntil", Instant.ofEpochMilli(snoozedUntilEpochMs).toString())
        if (nextOccurrence != null) putMap("nextOccurrence", ReminderDtoWriter.writeOccurrence(nextOccurrence))
    }
}
