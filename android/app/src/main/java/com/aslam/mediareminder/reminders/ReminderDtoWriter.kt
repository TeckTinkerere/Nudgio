package com.aslam.mediareminder.reminders

import com.aslam.mediareminder.alarm.RepeatSummaryFormatter
import com.aslam.mediareminder.alarm.ScheduleRuleMapper
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.aslam.mediareminder.data.db.entity.OccurrenceEntity
import com.aslam.mediareminder.data.db.entity.ReminderEntity
import com.aslam.mediareminder.data.db.entity.ScheduleRuleEntity
import com.aslam.mediareminder.media.MediaStorage
import com.aslam.mediareminder.media.MediaThumbnailUri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import java.time.Instant

/**
 * Room entities -> the MR-08 `ReminderSummary`/`ReminderDetail`/
 * `OccurrenceSummary` wire shapes (`native-client/types.ts`).
 *
 * `media` is nullable: `reminders.media_id` has no `media_assets` foreign
 * key yet (the same documented gap as [ReminderEntity]'s missing constraint,
 * docs/decision-log.md), so a caller passes whatever
 * `MediaDao.getById`/`getByIds` found — normally always something, but a
 * null is handled honestly (`mediaKind` falls back to `"video"`,
 * `thumbnailToken` stays absent) rather than assumed impossible.
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
        media: MediaAssetEntity?,
        storage: MediaStorage,
    ): WritableMap = Arguments.createMap().apply {
        putString("id", reminder.id)
        putString("label", reminder.label)
        putString("mediaId", reminder.mediaId)
        putString("mediaKind", media?.kind ?: "video")
        val thumbnailToken = media?.let { MediaThumbnailUri.resolveThumbnail(it, storage) }
        if (thumbnailToken != null) putString("thumbnailToken", thumbnailToken) else putNull("thumbnailToken")
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
        media: MediaAssetEntity?,
        storage: MediaStorage,
    ): WritableMap {
        val map = writeSummary(reminder, ruleEntity, nextOccurrence, media, storage)
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
