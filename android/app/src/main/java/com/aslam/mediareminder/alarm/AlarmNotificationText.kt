package com.aslam.mediareminder.alarm

import android.content.Context
import com.aslam.mediareminder.R
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.ReminderEntity

/**
 * The due notification's body (its title is always `reminder.label`).
 *
 * The user's own message wins (DL-080): "You have work tomorrow." is the
 * whole point of the reminder, a file name like `IMG_2041` is not. Without
 * a message it falls back to the linked media's title (KNOWN_ISSUES.md "shows
 * the reminder label twice"), then to the schedule's plain-language summary
 * — never `reminder.label` again.
 */
object AlarmNotificationText {
    suspend fun resolveBody(database: MediaReminderDatabase, reminder: ReminderEntity): String {
        reminder.notes?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }

        val media = database.mediaDao().getById(reminder.mediaId)
        if (media != null && media.title.isNotBlank()) return media.title

        val ruleEntity = database.scheduleRuleDao().getByReminderId(reminder.id)
        return ruleEntity?.let { RepeatSummaryFormatter.summarize(ScheduleRuleMapper.toDomain(it)) } ?: reminder.label
    }

    /**
     * The verb on Play, named for what is about to open: "Play" reads wrong
     * for a photo. Shared by the notification and the full-screen alarm so
     * the same reminder never says two different things.
     */
    fun acceptLabelRes(kind: String?): Int = when (kind) {
        "video" -> R.string.alarm_accept_video
        "audio" -> R.string.alarm_accept_audio
        "image" -> R.string.alarm_accept_image
        else -> R.string.alarm_accept
    }

    suspend fun acceptLabel(context: Context, database: MediaReminderDatabase, reminder: ReminderEntity): String =
        context.getString(acceptLabelRes(database.mediaDao().getById(reminder.mediaId)?.kind))
}
