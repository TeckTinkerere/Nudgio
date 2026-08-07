package com.aslam.mediareminder.reminders

import com.aslam.mediareminder.alarm.RepeatSummaryFormatter
import com.aslam.mediareminder.alarm.ScheduleRuleMapper
import com.aslam.mediareminder.data.db.entity.OccurrenceEntity
import com.aslam.mediareminder.data.db.entity.ReminderEntity
import com.aslam.mediareminder.data.db.entity.ScheduleRuleEntity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.time.Instant

/**
 * Room entities -> the MR-08 `ReminderSummary`/`ReminderDetail`/
 * `OccurrenceSummary` wire shapes (`native-client/types.ts`).
 *
 * `mediaKind` is hardcoded `"video"` and `thumbnailToken` is always absent:
 * `reminders.media_id` has no `media_assets` table to join against yet — the
 * same documented gap as [ReminderEntity]'s missing foreign key
 * (docs/decision-log.md). This is the honest, visible answer rather than a
 * silent one, and matches the JS demo module's own `media?.kind ?? 'video'`
 * fallback exactly.
 */
object ReminderDtoWriter {

    fun writeOccurrence(entity: OccurrenceEntity): WritableMap = Arguments.createMap().apply {
        putString("id", entity.id)
        putString("reminderId", entity.reminderId)
        putString("kind", entity.kind)
        putString("scheduledAt", Instant.ofEpochMilli(entity.scheduledAt).toString())
        putString("state", entity.state)
    }

    fun writeSummary(
        reminder: ReminderEntity,
        ruleEntity: ScheduleRuleEntity,
        nextOccurrence: OccurrenceEntity?,
    ): WritableMap = Arguments.createMap().apply {
        putString("id", reminder.id)
        putString("label", reminder.label)
        putString("mediaId", reminder.mediaId)
        putString("mediaKind", "video")
        putString("profileId", reminder.profileId)
        putBoolean("enabledIntent", reminder.enabledIntent)
        putString("effectiveState", reminder.effectiveState)
        if (nextOccurrence != null) putMap("nextOccurrence", writeOccurrence(nextOccurrence)) else putNull("nextOccurrence")
        putString("repeatSummary", RepeatSummaryFormatter.summarize(ScheduleRuleMapper.toDomain(ruleEntity)))
    }

    /** Extends [writeSummary]'s map with `ReminderDetail`'s extra fields — a `WritableNativeMap` accepts more `put*` calls right up until it is consumed by `promise.resolve()`. */
    fun writeDetail(
        reminder: ReminderEntity,
        ruleEntity: ScheduleRuleEntity,
        nextOccurrence: OccurrenceEntity?,
    ): WritableMap {
        val map = writeSummary(reminder, ruleEntity, nextOccurrence)
        val notes = reminder.notes
        if (notes != null) map.putString("notes", notes) else map.putNull("notes")
        map.putMap("schedule", ScheduleRuleBridge.writeRule(ScheduleRuleMapper.toDomain(ruleEntity)))
        map.putMap(
            "snooze",
            Arguments.createMap().apply {
                putInt("defaultMinutes", reminder.snoozeDefaultMinutes)
                putBoolean("allowCustom", reminder.snoozeAllowCustom)
                putInt("minimumMinutes", reminder.snoozeMinimumMinutes)
                putInt("maximumMinutes", reminder.snoozeMaximumMinutes)
            },
        )
        map.putBoolean("historyEnabled", reminder.historyEnabled)
        map.putString("createdAt", Instant.ofEpochMilli(reminder.createdAt).toString())
        map.putString("updatedAt", Instant.ofEpochMilli(reminder.updatedAt).toString())
        map.putInt("entityVersion", reminder.entityVersion)
        return map
    }
}
