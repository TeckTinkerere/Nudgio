package com.aslam.mediareminder.backup

import com.aslam.mediareminder.alarm.ScheduleRule
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime

/**
 * JVM unit tests for [BackupScheduleRuleCodec] — the [ScheduleRule] <->
 * `data/schedule-rules.json` record round trip (MR-10). No Android
 * dependency; runs on the plain JVM.
 */
class BackupScheduleRuleCodecTest {

    private val reminderId = "22222222-2222-4222-8222-222222222222"

    private fun roundTrip(rule: ScheduleRule): ScheduleRule {
        val json = BackupScheduleRuleCodec.toJson(reminderId, rule)
        val (parsedId, parsedRule) = BackupScheduleRuleCodec.fromJson(json)
        assertEquals(reminderId, parsedId)
        return parsedRule
    }

    @Test
    fun `once round-trips instant and origin zone`() {
        val rule = ScheduleRule.Once(Instant.parse("2026-06-01T08:00:00Z"), originZone = "America/New_York")
        assertEquals(rule, roundTrip(rule))
    }

    @Test
    fun `daily round-trips local time`() {
        val rule = ScheduleRule.Daily(LocalTime.of(6, 15))
        assertEquals(rule, roundTrip(rule))
    }

    @Test
    fun `weekly round-trips local time and weekdays regardless of input order`() {
        val rule = ScheduleRule.Weekly(LocalTime.of(14, 30), setOf(5, 1, 3))
        assertEquals(rule, roundTrip(rule))
    }

    @Test
    fun `monthly round-trips local time and day of month`() {
        val rule = ScheduleRule.Monthly(LocalTime.of(9, 0), 31)
        assertEquals(rule, roundTrip(rule))
    }

    @Test
    fun `yearly round-trips local time, month and day`() {
        val rule = ScheduleRule.Yearly(LocalTime.of(8, 0), 2, 29)
        assertEquals(rule, roundTrip(rule))
    }

    @Test
    fun `custom round-trips local time, interval and anchor date`() {
        val rule = ScheduleRule.Custom(LocalTime.of(10, 0), intervalDays = 3, anchorDate = LocalDate.of(2026, 8, 1))
        assertEquals(rule, roundTrip(rule))
    }

    @Test
    fun `a midnight-exact local time is not truncated to HH mm`() {
        // LocalTime.toString() omits seconds when they are zero (":00" would
        // otherwise round-trip as "06:15" -> parses fine, but this pins the
        // formatter's explicit ":00" padding so a future LocalTime change
        // that starts including seconds elsewhere can't silently regress it).
        val json = BackupScheduleRuleCodec.toJson(reminderId, ScheduleRule.Daily(LocalTime.of(6, 15)))
        assertEquals("06:15:00", json.getString("localTime"))
    }

    @Test
    fun `fromJson rejects a missing reminderId`() {
        val json = BackupScheduleRuleCodec.toJson(reminderId, ScheduleRule.Daily(LocalTime.of(6, 0)))
        json.put("reminderId", "")

        val error = assertThrows(BackupFormatException::class.java) { BackupScheduleRuleCodec.fromJson(json) }
        assertEquals("schedule_rule_missing_reminder_id", error.reasonCode)
    }

    @Test
    fun `fromJson rejects an unknown rule type`() {
        val json = BackupScheduleRuleCodec.toJson(reminderId, ScheduleRule.Daily(LocalTime.of(6, 0)))
        json.put("type", "hourly")

        val error = assertThrows(BackupFormatException::class.java) { BackupScheduleRuleCodec.fromJson(json) }
        assertEquals("schedule_rule_unknown_type", error.reasonCode)
    }

    @Test
    fun `fromJson wraps a malformed field as a BackupFormatException`() {
        val json = BackupScheduleRuleCodec.toJson(reminderId, ScheduleRule.Daily(LocalTime.of(6, 0)))
        json.put("localTime", "not-a-time")

        val error = assertThrows(BackupFormatException::class.java) { BackupScheduleRuleCodec.fromJson(json) }
        assertEquals("schedule_rule_malformed", error.reasonCode)
    }
}
