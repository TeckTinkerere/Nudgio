package com.aslam.mediareminder.alarm

import java.time.LocalTime
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale

/**
 * MR-13: "Repeat rules are summarized in plain language" and MR-08:
 * `ReminderSummary.repeatSummary` is "already localized on the native side...
 * rendered text, not a lookup key." This is that formatter.
 *
 * English only for now — MR-13 "Language roadmap": "V1 ships English."
 * Swapping this for a real `Resources`-backed, plural-aware implementation
 * (using [android.icu.text.MessageFormat] or plain string-resource plurals)
 * is the natural extension point once Tamil/Arabic land; the *shape* of the
 * output (a complete sentence fragment, no concatenation of translated
 * fragments at the call site) already matches what that migration needs.
 */
object RepeatSummaryFormatter {

    private val timeFormatter = DateTimeFormatter.ofLocalizedTime(FormatStyle.SHORT).withLocale(Locale.US)
    private val weekdayNames = listOf("Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun")
    private val monthNames = listOf(
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    )

    fun summarize(rule: ScheduleRule): String = when (rule) {
        is ScheduleRule.Once -> "Once"
        is ScheduleRule.Daily -> "Every day at ${format(rule.localTime)}"
        is ScheduleRule.Weekly -> "${weekdayList(rule.isoWeekdays)} at ${format(rule.localTime)}"
        is ScheduleRule.Monthly -> "Monthly on day ${rule.dayOfMonth} at ${format(rule.localTime)}"
        is ScheduleRule.Yearly ->
            "Yearly on ${monthNames[rule.month - 1]} ${rule.dayOfMonth} at ${format(rule.localTime)}"
        is ScheduleRule.Custom -> "Every ${rule.intervalDays} days at ${format(rule.localTime)}"
    }

    private fun format(time: LocalTime): String = time.format(timeFormatter)

    private fun weekdayList(isoWeekdays: Set<Int>): String {
        val sorted = isoWeekdays.sorted()
        if (sorted == listOf(1, 2, 3, 4, 5)) return "Weekdays"
        if (sorted == listOf(6, 7)) return "Weekends"
        if (sorted == listOf(1, 2, 3, 4, 5, 6, 7)) return "Every day"
        return sorted.joinToString(", ") { weekdayNames[it - 1] }
    }
}
