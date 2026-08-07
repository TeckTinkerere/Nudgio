package com.aslam.mediareminder.alarm

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime

/**
 * JVM unit tests for [OccurrenceCalculator] — MR-18: "Pure recurrence/domain
 * -> Unit/property tests." No Android dependency is exercised anywhere in
 * this file; it runs on the plain JVM (`./gradlew test`), not an emulator.
 *
 * DST fixture dates are historical, verified US transitions (not this
 * project's 2026 "today"), specifically so the test does not depend on this
 * assistant's assumption about a not-yet-elapsed transition date:
 *  - 2023-03-12: spring-forward, America/New_York, 2:00 AM -> 3:00 AM.
 *  - 2023-11-05: fall-back, America/New_York, 2:00 AM -> 1:00 AM.
 */
class OccurrenceCalculatorTest {

    private val zone: ZoneId = ZoneId.of("America/New_York")
    private val utc: ZoneId = ZoneId.of("UTC")

    private fun instantAt(date: LocalDate, time: LocalTime, zoneId: ZoneId = zone): Instant =
        ZonedDateTime.of(date, time, zoneId).toInstant()

    // --- once ------------------------------------------------------------------

    @Test
    fun `once returns the instant when it is still in the future`() {
        val target = instantAt(LocalDate.of(2026, 6, 1), LocalTime.of(8, 0))
        val after = instantAt(LocalDate.of(2026, 5, 1), LocalTime.of(0, 0))

        assertEquals(target, OccurrenceCalculator.nextOccurrence(ScheduleRule.Once(target), zone, after))
    }

    @Test
    fun `once returns null when it has already passed (skip completed)`() {
        val target = instantAt(LocalDate.of(2026, 1, 1), LocalTime.of(8, 0))
        val after = instantAt(LocalDate.of(2026, 6, 1), LocalTime.of(0, 0))

        assertNull(OccurrenceCalculator.nextOccurrence(ScheduleRule.Once(target), zone, after))
    }

    // --- daily -------------------------------------------------------------------

    @Test
    fun `daily rolls to today when the time has not yet passed`() {
        val rule = ScheduleRule.Daily(LocalTime.of(6, 15))
        val after = instantAt(LocalDate.of(2026, 4, 10), LocalTime.of(5, 0))

        val next = OccurrenceCalculator.nextOccurrence(rule, zone, after)

        assertEquals(instantAt(LocalDate.of(2026, 4, 10), LocalTime.of(6, 15)), next)
    }

    @Test
    fun `daily rolls to tomorrow when the time has already passed`() {
        val rule = ScheduleRule.Daily(LocalTime.of(6, 15))
        val after = instantAt(LocalDate.of(2026, 4, 10), LocalTime.of(7, 0))

        val next = OccurrenceCalculator.nextOccurrence(rule, zone, after)

        assertEquals(instantAt(LocalDate.of(2026, 4, 11), LocalTime.of(6, 15)), next)
    }

    // --- weekly --------------------------------------------------------------------

    @Test
    fun `weekly finds the next matching weekday across a week boundary`() {
        // 2026-04-10 is a Friday; rule fires Mon/Wed/Fri at 14:30.
        val rule = ScheduleRule.Weekly(LocalTime.of(14, 30), setOf(1, 3, 5))
        val after = instantAt(LocalDate.of(2026, 4, 10), LocalTime.of(15, 0)) // after Friday's slot

        val next = OccurrenceCalculator.nextOccurrence(rule, zone, after)

        // Next Monday.
        assertEquals(instantAt(LocalDate.of(2026, 4, 13), LocalTime.of(14, 30)), next)
    }

    @Test
    fun `weekly single day repeats weekly`() {
        val rule = ScheduleRule.Weekly(LocalTime.of(17, 0), setOf(7)) // Sunday
        val after = instantAt(LocalDate.of(2026, 4, 5), LocalTime.of(18, 0)) // a Sunday, after the slot

        val next = OccurrenceCalculator.nextOccurrence(rule, zone, after)

        assertEquals(instantAt(LocalDate.of(2026, 4, 12), LocalTime.of(17, 0)), next)
    }

    // --- monthly -------------------------------------------------------------------

    @Test
    fun `monthly clamps day 31 to February's actual length`() {
        val rule = ScheduleRule.Monthly(LocalTime.of(9, 0), 31)
        val after = instantAt(LocalDate.of(2026, 1, 31), LocalTime.of(10, 0)) // after January's slot

        val next = OccurrenceCalculator.nextOccurrence(rule, zone, after)

        // 2026 is not a leap year: February has 28 days.
        assertEquals(instantAt(LocalDate.of(2026, 2, 28), LocalTime.of(9, 0)), next)
    }

    @Test
    fun `monthly advances to next month when this month's day has passed`() {
        val rule = ScheduleRule.Monthly(LocalTime.of(9, 0), 1)
        val after = instantAt(LocalDate.of(2026, 4, 1), LocalTime.of(10, 0))

        val next = OccurrenceCalculator.nextOccurrence(rule, zone, after)

        assertEquals(instantAt(LocalDate.of(2026, 5, 1), LocalTime.of(9, 0)), next)
    }

    // --- yearly --------------------------------------------------------------------

    @Test
    fun `yearly clamps Feb 29 to Feb 28 in a non-leap year`() {
        val rule = ScheduleRule.Yearly(LocalTime.of(8, 0), 2, 29)
        val after = instantAt(LocalDate.of(2026, 1, 1), LocalTime.of(0, 0))

        val next = OccurrenceCalculator.nextOccurrence(rule, zone, after)

        assertEquals(instantAt(LocalDate.of(2026, 2, 28), LocalTime.of(8, 0)), next)
    }

    @Test
    fun `yearly uses Feb 29 itself in a leap year`() {
        val rule = ScheduleRule.Yearly(LocalTime.of(8, 0), 2, 29)
        // `nextYearly` searches starting from `after`'s own year first — a
        // non-leap starting year (e.g. 2027) resolves to *that* year's
        // clamped Feb 28 immediately (see the "clamps... in a non-leap year"
        // case above) without ever reaching a later leap year. To actually
        // exercise "Feb 29 used literally," `after` must itself fall inside
        // a leap year, before Feb 29 of that same year.
        val after = instantAt(LocalDate.of(2028, 1, 1), LocalTime.of(0, 0))

        val next = OccurrenceCalculator.nextOccurrence(rule, zone, after)

        // 2028 is a leap year — no clamping, resolves within the same year.
        assertEquals(instantAt(LocalDate.of(2028, 2, 29), LocalTime.of(8, 0)), next)
    }

    // --- custom -------------------------------------------------------------------

    @Test
    fun `custom every 3 days lands on an anchor-aligned date`() {
        val anchor = LocalDate.of(2026, 8, 1)
        val rule = ScheduleRule.Custom(LocalTime.of(10, 0), intervalDays = 3, anchorDate = anchor)
        val after = instantAt(LocalDate.of(2026, 8, 5), LocalTime.of(0, 0))

        val next = OccurrenceCalculator.nextOccurrence(rule, zone, after)

        // Anchor-aligned dates: Aug 1, 4, 7, ... Aug 7 is the first one after Aug 5.
        assertEquals(instantAt(LocalDate.of(2026, 8, 7), LocalTime.of(10, 0)), next)
    }

    @Test
    fun `custom returns the anchor date itself when after precedes it`() {
        val anchor = LocalDate.of(2026, 8, 1)
        val rule = ScheduleRule.Custom(LocalTime.of(10, 0), intervalDays = 3, anchorDate = anchor)
        val after = instantAt(LocalDate.of(2026, 7, 1), LocalTime.of(0, 0))

        val next = OccurrenceCalculator.nextOccurrence(rule, zone, after)

        assertEquals(instantAt(anchor, LocalTime.of(10, 0)), next)
    }

    // --- DST gap (spring-forward) --------------------------------------------------

    @Test
    fun `daily rule during a spring-forward gap pushes forward past the gap`() {
        // 2023-03-12: America/New_York clocks jump 02:00 -> 03:00. 02:30 does not exist.
        val rule = ScheduleRule.Daily(LocalTime.of(2, 30))
        val after = instantAt(LocalDate.of(2023, 3, 11), LocalTime.of(3, 0))

        val next = OccurrenceCalculator.nextOccurrence(rule, zone, after)
        checkNotNull(next)

        val resolved = ZonedDateTime.ofInstant(next, zone)
        // The gap is 1 hour; 02:30 + 1:00 = 03:30, at the post-transition offset.
        assertEquals(LocalTime.of(3, 30), resolved.toLocalTime())
        assertEquals(LocalDate.of(2023, 3, 12), resolved.toLocalDate())
    }

    // --- DST overlap (fall-back) -----------------------------------------------------

    @Test
    fun `daily rule during a fall-back overlap defaults to the first occurrence`() {
        // 2023-11-05: America/New_York clocks fall back 02:00 -> 01:00. 01:30 occurs twice.
        val rule = ScheduleRule.Daily(LocalTime.of(1, 30))
        val after = instantAt(LocalDate.of(2023, 11, 4), LocalTime.of(3, 0))

        val next = OccurrenceCalculator.nextOccurrence(rule, zone, after, preferLaterOnOverlap = false)
        checkNotNull(next)

        val resolved = ZonedDateTime.ofInstant(next, zone)
        assertEquals(LocalTime.of(1, 30), resolved.toLocalTime())
        // The first pass through 01:30 is still on daylight time (UTC-4).
        assertEquals("-04:00", resolved.offset.id)
    }

    @Test
    fun `preferLaterOnOverlap resolves to the second occurrence`() {
        val rule = ScheduleRule.Daily(LocalTime.of(1, 30))
        val after = instantAt(LocalDate.of(2023, 11, 4), LocalTime.of(3, 0))

        val first = OccurrenceCalculator.nextOccurrence(rule, zone, after, preferLaterOnOverlap = false)
        val second = OccurrenceCalculator.nextOccurrence(rule, zone, after, preferLaterOnOverlap = true)
        checkNotNull(first)
        checkNotNull(second)

        assertTrue("second occurrence must be strictly after the first", second.isAfter(first))
        // Exactly one hour apart — the length of the fall-back transition.
        assertEquals(3600L, second.epochSecond - first.epochSecond)
    }

    // --- timezone-follow-device (MR-08) ---------------------------------------------

    @Test
    fun `the same rule resolves differently under a different zone`() {
        val rule = ScheduleRule.Daily(LocalTime.of(9, 0))
        val after = instantAt(LocalDate.of(2026, 4, 10), LocalTime.of(0, 0), utc)

        val nyResult = OccurrenceCalculator.nextOccurrence(rule, zone, after)
        val utcResult = OccurrenceCalculator.nextOccurrence(rule, utc, after)

        assertTrue(
            "9 AM New York and 9 AM UTC on the same date must be different instants",
            nyResult != utcResult,
        )
    }
}
