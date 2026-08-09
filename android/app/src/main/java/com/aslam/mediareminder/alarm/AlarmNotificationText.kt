package com.aslam.mediareminder.alarm

import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.ReminderEntity

/**
 * KNOWN_ISSUES.md "Every due-alarm notification currently shows the reminder
 * label twice": `mediaTitle` had no real value to source until media import
 * existed (DL-012); it now does (every [ReminderEntity] has a non-null
 * `mediaId`). Resolves the notification body to the linked media's own
 * title, falling back to the schedule's plain-language summary — never
 * `reminder.label` again, since that is already the notification's title.
 */
object AlarmNotificationText {
    suspend fun resolveBody(database: MediaReminderDatabase, reminder: ReminderEntity): String {
        val media = database.mediaDao().getById(reminder.mediaId)
        if (media != null && media.title.isNotBlank()) return media.title

        val ruleEntity = database.scheduleRuleDao().getByReminderId(reminder.id)
        return ruleEntity?.let { RepeatSummaryFormatter.summarize(ScheduleRuleMapper.toDomain(it)) } ?: reminder.label
    }
}
