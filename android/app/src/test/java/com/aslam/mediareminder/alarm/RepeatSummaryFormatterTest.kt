package com.aslam.mediareminder.alarm

import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.Instant
import java.time.LocalTime
import java.time.ZoneId

class RepeatSummaryFormatterTest {

    private val singapore = ZoneId.of("Asia/Singapore")

    @Test
    fun `one-time reminders say when, in the device zone`() {
        val rule = ScheduleRule.Once(Instant.parse("2026-10-02T12:30:00Z"))
        assertEquals("Once on Fri 2 Oct at 8:30 PM", RepeatSummaryFormatter.summarize(rule, singapore))
    }

    @Test
    fun `repeating reminders keep their existing wording`() {
        assertEquals("Every day at 7:00 AM", RepeatSummaryFormatter.summarize(ScheduleRule.Daily(LocalTime.of(7, 0)), singapore))
    }
}
