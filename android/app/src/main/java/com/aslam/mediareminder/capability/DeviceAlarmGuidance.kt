package com.aslam.mediareminder.capability

/**
 * Which phone maker's battery manager this device has (DL-124).
 *
 * Several makers add their own app-killing rules on top of Android's, and a
 * reminder app the user never opens is exactly what those rules stop. MR-06
 * allows telling the user: "OEM troubleshooting is optional,
 * manufacturer-specific guidance is clearly labeled, and Test reminder is
 * preferred over asking for unrestricted background operation."
 *
 * This only names the maker. The steps are words on the Health screen
 * (`lib/features/health/device_guidance.dart`); nothing here opens a settings
 * page or requests an exemption (AND-017), and the capability's status does
 * not change because of it.
 */
object DeviceAlarmGuidance {
    const val KEY_PREFIX = "capability.batteryEnvironment.guidance."

    // Sub-brands report their parent in MANUFACTURER on some models and their
    // own name on others, so both fields are checked against the same table.
    private val families = mapOf(
        "xiaomi" to "xiaomi",
        "redmi" to "xiaomi",
        "poco" to "xiaomi",
        "samsung" to "samsung",
        "huawei" to "huawei",
        "honor" to "honor",
        "oppo" to "oppo",
        "realme" to "oppo",
        "oneplus" to "oppo",
        "vivo" to "vivo",
        "iqoo" to "vivo",
    )

    /** `capability.batteryEnvironment.guidance.<maker>`, or null for a maker with no known extra rules. */
    fun keyFor(manufacturer: String?, brand: String?): String? {
        val family = sequenceOf(brand, manufacturer)
            .mapNotNull { it?.trim()?.lowercase() }
            .mapNotNull { families[it] }
            .firstOrNull()
        return family?.let { KEY_PREFIX + it }
    }
}
