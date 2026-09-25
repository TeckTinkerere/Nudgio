package com.aslam.mediareminder.alarm

import com.aslam.mediareminder.data.db.MediaReminderDatabase

/**
 * "What should Play open?" for [AlarmActionReceiver]'s notification-tap Play
 * action — the same answer [AlarmActivity] reaches from the media row it
 * already loads for its artwork.
 *
 * Returns the media id only if that row still exists — a reminder's
 * `mediaId` can point at something since deleted, and Play should not hand
 * JS a dangling id to fail on.
 */
object AcceptMediaResolver {
    suspend fun resolve(database: MediaReminderDatabase, reminderId: String): String? {
        val reminder = database.reminderDao().getById(reminderId) ?: return null
        val media = database.mediaDao().getById(reminder.mediaId)
        return media?.id
    }
}
