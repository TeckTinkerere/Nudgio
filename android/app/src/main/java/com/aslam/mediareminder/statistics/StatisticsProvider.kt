package com.aslam.mediareminder.statistics

import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.OccurrenceEntity
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Real, Room-backed aggregation over `occurrences` for the Statistics screen
 * (MR-04 "Charts and history"), replacing the `mockStatistics` fixture the
 * screen rendered until now — every number it showed was invented.
 *
 * Day bucketing happens in Kotlin against [ZoneId.systemDefault], not in SQL.
 * SQLite's `date(..., 'localtime')` would work but resolves the offset per
 * row using the *device's current* rules, which silently splits a DST
 * transition day in two and cannot express "the seven days ending today" the
 * way the caller means it. Computing the window boundaries once, here, keeps
 * the day a `LocalDate` throughout and matches how `OccurrenceCalculator`
 * already reasons about local days.
 *
 * Only *resolved* outcomes are counted. `pending` and `claimed` are alarms
 * that have not happened yet (or are ringing right now) — including them
 * would inflate every total with occurrences the user has not had a chance
 * to act on, and would make today's row grow and shrink as alarms resolve.
 */
class StatisticsProvider(private val database: MediaReminderDatabase) {

    data class Summary(
        val rangeDays: Int,
        val totalOccurrences: Int,
        val completed: Int,
        val dismissed: Int,
        val missed: Int,
        val snoozed: Int,
        val mostActiveReminderLabel: String?,
        val dailyBreakdown: List<Day>,
    )

    data class Day(
        /** ISO `yyyy-MM-dd`, local. The UI formats it; this stays unambiguous. */
        val date: String,
        val completed: Int,
        val dismissed: Int,
        val missed: Int,
    )

    suspend fun summarize(rangeDays: Int): Summary {
        val zone = ZoneId.systemDefault()
        val today = LocalDate.now(zone)
        // `rangeDays - 1`: a 7-day range is today plus the six days before it,
        // not today plus seven.
        val firstDay = today.minusDays((rangeDays - 1).toLong())
        val fromEpochMs = firstDay.atStartOfDay(zone).toInstant().toEpochMilli()
        // Exclusive upper bound at the start of tomorrow, so an occurrence at
        // 23:59:59.999 today is still counted as today.
        val toEpochMs = today.plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli()

        val rows = database.occurrenceDao().resolvedBetween(fromEpochMs, toEpochMs)

        var completed = 0
        var dismissed = 0
        var missed = 0
        var snoozed = 0
        val perDay = LinkedHashMap<LocalDate, IntArray>()
        val perReminder = HashMap<String, Int>()

        // Seed every day in the window, so a day with no activity still
        // renders a row instead of being silently skipped — an empty
        // Wednesday is information, not absence of it.
        var cursor = firstDay
        while (!cursor.isAfter(today)) {
            perDay[cursor] = IntArray(3)
            cursor = cursor.plusDays(1)
        }

        for (row in rows) {
            val day = Instant.ofEpochMilli(row.scheduledAt).atZone(zone).toLocalDate()
            val bucket = perDay[day] ?: continue
            when (row.state) {
                // "Completed" is the user having actually engaged with the
                // reminder. A snooze is not a resolution — the occurrence it
                // spawns is counted on its own when it later resolves — so it
                // is tallied for the headline figure but never folded into a
                // day's completed/dismissed/missed split.
                OccurrenceEntity.STATE_ACCEPTED -> {
                    completed++
                    bucket[0]++
                }
                OccurrenceEntity.STATE_DISMISSED -> {
                    dismissed++
                    bucket[1]++
                }
                OccurrenceEntity.STATE_MISSED, OccurrenceEntity.STATE_TIMED_OUT -> {
                    missed++
                    bucket[2]++
                }
                OccurrenceEntity.STATE_SNOOZED -> snoozed++
                else -> Unit
            }
            perReminder[row.reminderId] = (perReminder[row.reminderId] ?: 0) + 1
        }

        val mostActiveId = perReminder.maxByOrNull { it.value }?.key
        val mostActiveLabel = mostActiveId?.let { database.reminderDao().getById(it)?.label }

        return Summary(
            rangeDays = rangeDays,
            totalOccurrences = completed + dismissed + missed,
            completed = completed,
            dismissed = dismissed,
            missed = missed,
            snoozed = snoozed,
            mostActiveReminderLabel = mostActiveLabel,
            dailyBreakdown = perDay.map { (date, counts) ->
                Day(
                    date = date.toString(),
                    completed = counts[0],
                    dismissed = counts[1],
                    missed = counts[2],
                )
            },
        )
    }
}
