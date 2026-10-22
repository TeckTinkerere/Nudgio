package com.aslam.mediareminder.backup

import com.aslam.mediareminder.data.db.entity.ReminderEntity
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

/** DL-118: an alarm may have no attachment, and a backup must carry that faithfully. */
class BackupReminderCodecTest {

    private fun reminder(mediaId: String?) = ReminderEntity(
        id = "r1",
        mediaId = mediaId,
        profileId = "p1",
        label = "Wake up",
        notes = null,
        enabledIntent = true,
        effectiveState = ReminderEntity.STATE_ACTIVE,
        snoozeDefaultMinutes = 10,
        snoozeAllowCustom = true,
        snoozeMinimumMinutes = 1,
        snoozeMaximumMinutes = 60,
        historyEnabled = true,
        createdAt = 1_700_000_000_000,
        updatedAt = 1_700_000_100_000,
    )

    @Test
    fun attachedReminderRoundTrips() {
        val json = BackupReminderCodec.toJson(reminder("m1"))
        assertEquals("m1", json.getString("mediaId"))
        assertEquals("m1", BackupReminderCodec.fromJson(json).mediaId)
    }

    @Test
    fun reminderWithoutAttachmentOmitsTheKeyAndRoundTripsAsNull() {
        val json = BackupReminderCodec.toJson(reminder(null))
        assertFalse("older readers must never see an empty mediaId", json.has("mediaId"))
        assertNull(BackupReminderCodec.fromJson(json).mediaId)
    }

    @Test
    fun explicitJsonNullAndBlankBothReadAsNoAttachment() {
        val base = BackupReminderCodec.toJson(reminder("m1"))
        base.put("mediaId", JSONObject.NULL)
        assertNull(BackupReminderCodec.fromJson(base).mediaId)
        base.put("mediaId", "")
        assertNull(BackupReminderCodec.fromJson(base).mediaId)
    }

    @Test
    fun archiveWrittenBeforeThisChangeStillReads() {
        // Every pre-2.3.4 archive has a mediaId on every reminder.
        val legacy = BackupReminderCodec.toJson(reminder("legacy-media"))
        assertEquals("legacy-media", BackupReminderCodec.fromJson(legacy).mediaId)
    }
}
