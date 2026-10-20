package com.aslam.mediareminder.alarm

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** DL-118: when does a ringing alarm offer Open? */
class AlarmNotificationTextTest {

    @Test
    fun attachmentAloneGivesSomethingToOpen() {
        assertTrue(AlarmNotificationText.hasOpenTarget(mediaId = "m1", actionType = null))
    }

    @Test
    fun followUpActionAloneGivesSomethingToOpen() {
        assertTrue(AlarmNotificationText.hasOpenTarget(mediaId = null, actionType = "open_link"))
    }

    @Test
    fun plainAlarmOffersOnlySnoozeAndDismiss() {
        assertFalse(AlarmNotificationText.hasOpenTarget(mediaId = null, actionType = null))
    }
}
