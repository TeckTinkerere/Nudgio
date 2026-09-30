package com.aslam.mediareminder.alarm

import org.junit.Assert.*
import org.junit.Test

class NotificationDeliveryPolicyTest {
    @Test fun appPermissionDenialBlocksRinging() {
        assertFalse(NotificationDeliveryPolicy.canAlert(false, 4, false))
    }
    @Test fun blockedMissingOrGroupedChannelBlocksRinging() {
        assertFalse(NotificationDeliveryPolicy.canAlert(true, 0, false))
        assertFalse(NotificationDeliveryPolicy.canAlert(true, null, false))
        assertFalse(NotificationDeliveryPolicy.canAlert(true, 4, true))
    }
    @Test fun visibleChannelAllowsAlertWithoutRequiringHeadsUp() {
        assertTrue(NotificationDeliveryPolicy.canAlert(true, 2, false))
        assertTrue(NotificationDeliveryPolicy.canAlert(true, 4, false))
    }
}
