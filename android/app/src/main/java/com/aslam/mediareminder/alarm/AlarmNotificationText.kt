package com.aslam.mediareminder.alarm

import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.aslam.mediareminder.data.db.entity.ReminderEntity

/**
 * Everything the due notification says and shows, resolved in one pass.
 *
 * KNOWN_ISSUES.md "Every due-alarm notification currently shows the reminder
 * label twice": `mediaTitle` had no real value to source until media import
 * existed (DL-012); it now does (every [ReminderEntity] has a non-null
 * `mediaId`). The body is the linked media's own title, falling back to the
 * schedule's plain-language summary — never `reminder.label` again, since
 * that is already the notification's title.
 *
 * [AlarmNotificationContent.subText] is that same schedule summary, promoted
 * to the notification's header line ("Every day at 8:00 PM", beside the app
 * name) — but only when it is not already the body, so a reminder whose media
 * has no title does not print the same sentence twice, which is the exact bug
 * this file was created to fix.
 *
 * [AlarmNotificationContent.media] is handed back rather than re-queried by
 * the caller so the artwork ([AlarmArtwork]) comes from the same row as the
 * text, in one read.
 */
data class AlarmNotificationContent(
    /** Notification body: the media's title, else the schedule summary. */
    val body: String,
    /** Header line beside the app name, or null when it would repeat [body]. */
    val subText: String?,
    /** The linked media row, for artwork. Null when it could not be read. */
    val media: MediaAssetEntity?,
)

object AlarmNotificationText {

    suspend fun resolve(
        database: MediaReminderDatabase,
        reminder: ReminderEntity,
    ): AlarmNotificationContent {
        val media = database.mediaDao().getById(reminder.mediaId)
        val summary = database.scheduleRuleDao().getByReminderId(reminder.id)?.let {
            RepeatSummaryFormatter.summarize(ScheduleRuleMapper.toDomain(it))
        }
        val body = media?.title?.takeIf { it.isNotBlank() } ?: summary ?: reminder.label
        return AlarmNotificationContent(
            body = body,
            subText = summary?.takeIf { it != body },
            media = media,
        )
    }
}
