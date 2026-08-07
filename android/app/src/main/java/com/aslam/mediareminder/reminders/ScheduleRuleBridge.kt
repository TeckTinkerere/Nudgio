package com.aslam.mediareminder.reminders

import com.aslam.mediareminder.alarm.ScheduleRule
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime

/**
 * `ScheduleRuleDto` (`native-client/types.ts`) <-> [ScheduleRule]: the one
 * place the bridge's untyped `ReadableMap` becomes the typed domain rule
 * [com.aslam.mediareminder.alarm.OccurrenceCalculator] operates on, and the
 * one place a [ScheduleRule] read back from Room (via
 * [com.aslam.mediareminder.alarm.ScheduleRuleMapper.toDomain]) becomes the
 * wire shape the JS editor screens decode.
 */
object ScheduleRuleBridge {

    fun readRule(map: ReadableMap): ScheduleRule =
        when (val type = requireNotNull(map.getString("type")) { "schedule.type is required" }) {
            "once" -> ScheduleRule.Once(
                instant = Instant.parse(requireNotNull(map.getString("instant")) { "schedule.instant is required" }),
                originZone = map.getString("originZone") ?: "UTC",
            )
            "daily" -> ScheduleRule.Daily(localTime = readLocalTime(map))
            "weekdays" -> ScheduleRule.Weekly(
                localTime = readLocalTime(map),
                isoWeekdays = readIntArray(map, "isoWeekdays").toSet(),
            )
            "monthly" -> ScheduleRule.Monthly(
                localTime = readLocalTime(map),
                dayOfMonth = requireInt(map, "dayOfMonth"),
            )
            "yearly" -> ScheduleRule.Yearly(
                localTime = readLocalTime(map),
                month = requireInt(map, "month"),
                dayOfMonth = requireInt(map, "dayOfMonth"),
            )
            "custom" -> ScheduleRule.Custom(
                localTime = readLocalTime(map),
                intervalDays = requireInt(map, "intervalDays"),
                anchorDate = LocalDate.parse(requireNotNull(map.getString("anchorDate")) { "schedule.anchorDate is required" }),
            )
            else -> throw IllegalArgumentException("Unknown schedule rule type: $type")
        }

    fun writeRule(rule: ScheduleRule): WritableMap = Arguments.createMap().apply {
        when (rule) {
            is ScheduleRule.Once -> {
                putString("type", "once")
                putString("instant", rule.instant.toString())
                putString("originZone", rule.originZone)
            }
            is ScheduleRule.Daily -> {
                putString("type", "daily")
                putString("localTime", formatLocalTime(rule.localTime))
                putString("zonePolicy", "follow_device")
            }
            is ScheduleRule.Weekly -> {
                putString("type", "weekdays")
                putString("localTime", formatLocalTime(rule.localTime))
                putArray(
                    "isoWeekdays",
                    Arguments.createArray().apply { rule.isoWeekdays.sorted().forEach { pushInt(it) } },
                )
                putString("zonePolicy", "follow_device")
            }
            is ScheduleRule.Monthly -> {
                putString("type", "monthly")
                putString("localTime", formatLocalTime(rule.localTime))
                putInt("dayOfMonth", rule.dayOfMonth)
                putString("zonePolicy", "follow_device")
            }
            is ScheduleRule.Yearly -> {
                putString("type", "yearly")
                putString("localTime", formatLocalTime(rule.localTime))
                putInt("month", rule.month)
                putInt("dayOfMonth", rule.dayOfMonth)
                putString("zonePolicy", "follow_device")
            }
            is ScheduleRule.Custom -> {
                putString("type", "custom")
                putString("localTime", formatLocalTime(rule.localTime))
                putInt("intervalDays", rule.intervalDays)
                putString("anchorDate", rule.anchorDate.toString())
                putString("zonePolicy", "follow_device")
            }
        }
    }

    /** `LocalTime.toString()` omits `:ss` when seconds are zero; the DTO brand documents `HH:mm:ss`. */
    private fun formatLocalTime(time: LocalTime): String {
        val text = time.toString()
        return if (text.length == 5) "$text:00" else text
    }

    private fun readLocalTime(map: ReadableMap): LocalTime =
        LocalTime.parse(requireNotNull(map.getString("localTime")) { "schedule.localTime is required" })

    private fun requireInt(map: ReadableMap, key: String): Int {
        require(map.hasKey(key)) { "schedule.$key is required" }
        return map.getDouble(key).toInt()
    }

    private fun readIntArray(map: ReadableMap, key: String): List<Int> {
        val array = map.getArray(key) ?: throw IllegalArgumentException("schedule.$key is required")
        return (0 until array.size()).map { array.getDouble(it).toInt() }
    }
}
