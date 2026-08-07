package com.aslam.mediareminder.alarm

import java.time.LocalDate
import java.time.LocalTime

/**
 * Domain-level recurrence rule — the typed counterpart to
 * [com.aslam.mediareminder.data.db.entity.ScheduleRuleEntity]'s flattened,
 * nullable-column row and to the JS-side `ScheduleRuleDto` union
 * (`native-client/types.ts`). A sealed class instead of the entity's raw
 * columns is what lets [OccurrenceCalculator] be written as a straightforward
 * `when` with no per-branch null-checking of fields that don't apply to that
 * branch.
 *
 * `once` deliberately carries a UTC [java.time.Instant] with no time zone in
 * this type — the origin zone is metadata for display only (MR-13: "A once
 * reminder stores an instant and does not move when timezone changes"), not
 * an input to computing when it fires.
 */
sealed class ScheduleRule {
    /** @param originZone IANA zone id the user picked the instant in — display metadata only (see class doc), never an input to [OccurrenceCalculator]. */
    data class Once(val instant: java.time.Instant, val originZone: String = "UTC") : ScheduleRule()

    data class Daily(val localTime: LocalTime) : ScheduleRule()

    /**
     * @param isoWeekdays Monday = 1 ... Sunday = 7, matching
     *   [java.time.DayOfWeek.getValue]. Non-empty — an empty set can never
     *   produce an occurrence and is rejected by the repository before this
     *   type is constructed, not silently tolerated here.
     */
    data class Weekly(val localTime: LocalTime, val isoWeekdays: Set<Int>) : ScheduleRule()

    /** @param dayOfMonth 1-31; clamped to the target month's actual length at calculation time. */
    data class Monthly(val localTime: LocalTime, val dayOfMonth: Int) : ScheduleRule()

    /** @param month 1-12. @param dayOfMonth 1-31, clamped like [Monthly] (matters for Feb 29). */
    data class Yearly(val localTime: LocalTime, val month: Int, val dayOfMonth: Int) : ScheduleRule()

    /** @param intervalDays >= 1. @param anchorDate the date the interval counts from. */
    data class Custom(val localTime: LocalTime, val intervalDays: Int, val anchorDate: LocalDate) :
        ScheduleRule()
}
