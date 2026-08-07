package com.aslam.mediareminder.alarm

import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.YearMonth
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.temporal.ChronoUnit

/**
 * Pure recurrence engine. No Android dependency, no I/O, no `Context` — this
 * is what MR-07's "Domain calculation code has no Android UI dependency and
 * is JVM-testable" means literally: it can be unit-tested with plain JUnit
 * against the host JVM's `java.time`, no emulator required.
 *
 * MR-08's contract is binding here too: "UI never calculates authoritative
 * next occurrence." This class *is* the authority the bridge's
 * `saveReminder`/`getStartupSnapshot`/etc. results ultimately come from.
 *
 * ## DST policy (MR-03 "Repeat editor", MR-11 "Time and timezone changes")
 *
 * [java.time.LocalDateTime.atZone] already implements exactly the two
 * behaviors MR-03 specifies, so this class does not hand-roll gap/overlap
 * arithmetic:
 *
 *  - **Gap** (spring-forward — a local time that does not exist, e.g.
 *    2:30 AM when clocks jump 2:00 -> 3:00): the JDK resolves this by adding
 *    the length of the gap to the local time, landing on the first valid
 *    instant after the transition. That is precisely MR-03's example
 *    behavior ("2:30 AM does not occur on this date. The reminder will use
 *    3:00 AM" for a 30-minute gap, or 3:30 AM for the more common 1-hour
 *    gap) — "push forward past the gap," not "use the pre-gap wall time."
 *  - **Overlap** (fall-back — a local time that occurs twice): the JDK's
 *    documented default keeps the offset that was valid *before* the
 *    transition, which is the earlier chronological instant of the two —
 *    exactly MR-03's "default to the first occurrence." [preferLaterOnOverlap]
 *    exists for the MR-03 UI affordance ("Use second 1:30 AM") the user can
 *    opt into for one occurrence; the recurring rule itself always resolves
 *    to the first occurrence unless this flag is set for that call.
 *
 * ## Timezone-follow-device (MR-08 `zonePolicy: 'follow_device'`)
 *
 * Every method here takes [zoneId] as an explicit parameter and is otherwise
 * stateless — there is no cached "the reminder's zone." A timezone or DST
 * rule change is handled simply by calling this again with the *current*
 * device zone; nothing needs to be migrated or invalidated inside this class
 * itself. `SystemEventReceiver` re-invoking the scheduler on `TIMEZONE_CHANGED`
 * is what MR-11's "invalidates derived occurrences... recalculates" means in
 * practice — this function does not know or care that a change happened.
 *
 * ## Skip-completed / no-replay
 *
 * This class only answers "what is the next due instant after [after]." It
 * has no concept of "already handled" — that is
 * [com.aslam.mediareminder.data.db.entity.OccurrenceEntity.occurrenceKey]'s
 * job, enforced by a unique index at the repository/DAO layer (MR-09:
 * "Already resolved occurrence keys prevent replay after clock rollback").
 * The two responsibilities are deliberately not merged into one class.
 */
object OccurrenceCalculator {

    /** Defensive iteration cap so a malformed rule fails loudly instead of looping forever. */
    private const val MAX_ITERATIONS = 1000

    /**
     * The next instant strictly after [after] at which [rule] fires, or
     * `null` when the rule can never fire again (a `once` rule whose instant
     * has already passed — this is intentional "skip completed" behavior for
     * one-time reminders, not a bug).
     */
    fun nextOccurrence(
        rule: ScheduleRule,
        zoneId: ZoneId,
        after: Instant,
        preferLaterOnOverlap: Boolean = false,
    ): Instant? = when (rule) {
        is ScheduleRule.Once -> rule.instant.takeIf { it.isAfter(after) }
        is ScheduleRule.Daily -> nextDaily(rule, zoneId, after, preferLaterOnOverlap)
        is ScheduleRule.Weekly -> nextWeekly(rule, zoneId, after, preferLaterOnOverlap)
        is ScheduleRule.Monthly -> nextMonthly(rule, zoneId, after, preferLaterOnOverlap)
        is ScheduleRule.Yearly -> nextYearly(rule, zoneId, after, preferLaterOnOverlap)
        is ScheduleRule.Custom -> nextCustom(rule, zoneId, after, preferLaterOnOverlap)
    }

    private fun resolve(
        date: LocalDate,
        time: java.time.LocalTime,
        zoneId: ZoneId,
        preferLaterOnOverlap: Boolean,
    ): ZonedDateTime {
        val candidate = LocalDateTime.of(date, time).atZone(zoneId)
        // `atZone` already applies the "first occurrence" default for an
        // overlap (see the class doc); only when the caller explicitly wants
        // the second pass do we ask for the later offset.
        return if (preferLaterOnOverlap) candidate.withLaterOffsetAtOverlap() else candidate
    }

    private fun nextDaily(
        rule: ScheduleRule.Daily,
        zoneId: ZoneId,
        after: Instant,
        preferLaterOnOverlap: Boolean,
    ): Instant {
        var date = ZonedDateTime.ofInstant(after, zoneId).toLocalDate()
        repeat(MAX_ITERATIONS) {
            val candidate = resolve(date, rule.localTime, zoneId, preferLaterOnOverlap)
            if (candidate.toInstant().isAfter(after)) {
                return candidate.toInstant()
            }
            date = date.plusDays(1)
        }
        throw IllegalStateException("Daily rule did not resolve within $MAX_ITERATIONS days")
    }

    private fun nextWeekly(
        rule: ScheduleRule.Weekly,
        zoneId: ZoneId,
        after: Instant,
        preferLaterOnOverlap: Boolean,
    ): Instant {
        require(rule.isoWeekdays.isNotEmpty()) { "Weekly rule requires at least one weekday" }
        var date = ZonedDateTime.ofInstant(after, zoneId).toLocalDate()
        repeat(MAX_ITERATIONS) {
            if (rule.isoWeekdays.contains(date.dayOfWeek.value)) {
                val candidate = resolve(date, rule.localTime, zoneId, preferLaterOnOverlap)
                if (candidate.toInstant().isAfter(after)) {
                    return candidate.toInstant()
                }
            }
            date = date.plusDays(1)
        }
        throw IllegalStateException("Weekly rule did not resolve within $MAX_ITERATIONS days")
    }

    /** Clamps to the month's actual last day — matters for day 29-31 in short months and Feb 29. */
    private fun clampedDate(year: Int, month: Int, dayOfMonth: Int): LocalDate {
        val yearMonth = YearMonth.of(year, month)
        return yearMonth.atDay(minOf(dayOfMonth, yearMonth.lengthOfMonth()))
    }

    private fun nextMonthly(
        rule: ScheduleRule.Monthly,
        zoneId: ZoneId,
        after: Instant,
        preferLaterOnOverlap: Boolean,
    ): Instant {
        var yearMonth = YearMonth.from(ZonedDateTime.ofInstant(after, zoneId))
        repeat(MAX_ITERATIONS) {
            val date = clampedDate(yearMonth.year, yearMonth.monthValue, rule.dayOfMonth)
            val candidate = resolve(date, rule.localTime, zoneId, preferLaterOnOverlap)
            if (candidate.toInstant().isAfter(after)) {
                return candidate.toInstant()
            }
            yearMonth = yearMonth.plusMonths(1)
        }
        throw IllegalStateException("Monthly rule did not resolve within $MAX_ITERATIONS months")
    }

    private fun nextYearly(
        rule: ScheduleRule.Yearly,
        zoneId: ZoneId,
        after: Instant,
        preferLaterOnOverlap: Boolean,
    ): Instant {
        var year = ZonedDateTime.ofInstant(after, zoneId).year
        repeat(MAX_ITERATIONS) {
            val date = clampedDate(year, rule.month, rule.dayOfMonth)
            val candidate = resolve(date, rule.localTime, zoneId, preferLaterOnOverlap)
            if (candidate.toInstant().isAfter(after)) {
                return candidate.toInstant()
            }
            year += 1
        }
        throw IllegalStateException("Yearly rule did not resolve within $MAX_ITERATIONS years")
    }

    private fun nextCustom(
        rule: ScheduleRule.Custom,
        zoneId: ZoneId,
        after: Instant,
        preferLaterOnOverlap: Boolean,
    ): Instant {
        require(rule.intervalDays >= 1) { "Custom interval must be at least 1 day" }
        val afterDate = ZonedDateTime.ofInstant(after, zoneId).toLocalDate()
        // Plain day count between the two dates. `Period.until(...).days`
        // would only give the day component of a broken-down
        // years/months/days difference, undercounting anything more than a
        // month past the anchor — `ChronoUnit.DAYS.between` is the whole span.
        val elapsedDays = ChronoUnit.DAYS.between(rule.anchorDate, afterDate).toInt()
        val cyclesElapsed = if (elapsedDays <= 0) 0 else (elapsedDays + rule.intervalDays - 1) / rule.intervalDays
        var date = rule.anchorDate.plusDays(cyclesElapsed.toLong() * rule.intervalDays)
        repeat(MAX_ITERATIONS) {
            val candidate = resolve(date, rule.localTime, zoneId, preferLaterOnOverlap)
            if (candidate.toInstant().isAfter(after)) {
                return candidate.toInstant()
            }
            date = date.plusDays(rule.intervalDays.toLong())
        }
        throw IllegalStateException("Custom rule did not resolve within $MAX_ITERATIONS cycles")
    }

    /** ISO weekday (Monday = 1) for a given zoned instant — used by callers building UI previews. */
    fun isoWeekdayOf(instant: Instant, zoneId: ZoneId): Int =
        ZonedDateTime.ofInstant(instant, zoneId).dayOfWeek.value

    /** Exposed for tests and callers that need the platform's own weekday enum. */
    fun dayOfWeek(instant: Instant, zoneId: ZoneId): DayOfWeek =
        ZonedDateTime.ofInstant(instant, zoneId).dayOfWeek
}
