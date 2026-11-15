package com.aslam.mediareminder.capability

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/** DL-124. The keys here are the ones `lib/features/health/device_guidance.dart` has steps for. */
class DeviceAlarmGuidanceTest {

    private fun key(manufacturer: String?, brand: String?) = DeviceAlarmGuidance.keyFor(manufacturer, brand)

    @Test fun knownMakersGetTheirOwnKey() {
        assertEquals("capability.batteryEnvironment.guidance.samsung", key("samsung", "samsung"))
        assertEquals("capability.batteryEnvironment.guidance.xiaomi", key("Xiaomi", "Xiaomi"))
        assertEquals("capability.batteryEnvironment.guidance.huawei", key("HUAWEI", "HUAWEI"))
        assertEquals("capability.batteryEnvironment.guidance.honor", key("HONOR", "HONOR"))
        assertEquals("capability.batteryEnvironment.guidance.oppo", key("OPPO", "OPPO"))
        assertEquals("capability.batteryEnvironment.guidance.vivo", key("vivo", "vivo"))
    }

    @Test fun subBrandsShareTheirParentsSteps() {
        assertEquals("capability.batteryEnvironment.guidance.xiaomi", key("Xiaomi", "Redmi"))
        assertEquals("capability.batteryEnvironment.guidance.xiaomi", key("Xiaomi", "POCO"))
        assertEquals("capability.batteryEnvironment.guidance.oppo", key("realme", "realme"))
        assertEquals("capability.batteryEnvironment.guidance.oppo", key("OnePlus", "OnePlus"))
        assertEquals("capability.batteryEnvironment.guidance.vivo", key("vivo", "iQOO"))
    }

    @Test fun eitherFieldIsEnoughAndSpacingOrCaseDoNotMatter() {
        assertEquals("capability.batteryEnvironment.guidance.samsung", key(" SAMSUNG ", null))
        assertEquals("capability.batteryEnvironment.guidance.samsung", key(null, "Samsung"))
        assertEquals("capability.batteryEnvironment.guidance.samsung", key("unknown", "samsung"))
    }

    @Test fun otherMakersGetNoGuidance() {
        assertNull(key("Google", "google"))
        assertNull(key("motorola", "motorola"))
        assertNull(key(null, null))
        assertNull(key("", ""))
        // A partial match is not a match.
        assertNull(key("samsungish", "notvivo"))
    }
}
