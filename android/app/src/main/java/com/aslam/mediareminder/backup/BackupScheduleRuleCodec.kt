package com.aslam.mediareminder.backup

import com.aslam.mediareminder.alarm.ScheduleRule
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime

/**
 * [ScheduleRule] <-> the `data/schedule-rules.json` record shape (MR-10).
 * Deliberately the same field names as
 * [com.aslam.mediareminder.reminders.ScheduleRuleBridge] (the RN-bridge
 * codec) — both exist because a `ReadableMap`/`WritableMap` and a plain
 * `org.json.JSONObject` are different types, but the *portable* shape they
 * both represent is one thing, and keeping the field names identical is what
 * makes that visible.
 */
object BackupScheduleRuleCodec {

    fun toJson(reminderId: String, rule: ScheduleRule): JSONObject {
        val json = JSONObject().apply { put("reminderId", reminderId) }
        when (rule) {
            is ScheduleRule.Once -> {
                json.put("type", "once")
                json.put("instant", rule.instant.toString())
                json.put("originZone", rule.originZone)
            }
            is ScheduleRule.Daily -> {
                json.put("type", "daily")
                json.put("localTime", formatLocalTime(rule.localTime))
                json.put("zonePolicy", "follow_device")
            }
            is ScheduleRule.Weekly -> {
                json.put("type", "weekdays")
                json.put("localTime", formatLocalTime(rule.localTime))
                json.put("isoWeekdays", JSONArray(rule.isoWeekdays.sorted()))
                json.put("zonePolicy", "follow_device")
            }
            is ScheduleRule.Monthly -> {
                json.put("type", "monthly")
                json.put("localTime", formatLocalTime(rule.localTime))
                json.put("dayOfMonth", rule.dayOfMonth)
                json.put("zonePolicy", "follow_device")
            }
            is ScheduleRule.Yearly -> {
                json.put("type", "yearly")
                json.put("localTime", formatLocalTime(rule.localTime))
                json.put("month", rule.month)
                json.put("dayOfMonth", rule.dayOfMonth)
                json.put("zonePolicy", "follow_device")
            }
            is ScheduleRule.Custom -> {
                json.put("type", "custom")
                json.put("localTime", formatLocalTime(rule.localTime))
                json.put("intervalDays", rule.intervalDays)
                json.put("anchorDate", rule.anchorDate.toString())
                json.put("zonePolicy", "follow_device")
            }
        }
        return json
    }

    /** @return the reminder id the rule belongs to, paired with the parsed rule. */
    fun fromJson(json: JSONObject): Pair<String, ScheduleRule> {
        val reminderId = json.optString("reminderId", "")
        if (reminderId.isEmpty()) {
            throw BackupFormatException("schedule_rule_missing_reminder_id", "schedule-rules.json record missing reminderId")
        }
        val rule = decodeBackupRecord("schedule_rule_malformed", "Malformed schedule-rules.json record for $reminderId") {
            when (val type = json.getString("type")) {
                "once" -> ScheduleRule.Once(
                    instant = Instant.parse(json.getString("instant")),
                    originZone = json.optString("originZone", "UTC"),
                )
                "daily" -> ScheduleRule.Daily(localTime = LocalTime.parse(json.getString("localTime")))
                "weekdays" -> ScheduleRule.Weekly(
                    localTime = LocalTime.parse(json.getString("localTime")),
                    isoWeekdays = readIntArray(json.getJSONArray("isoWeekdays")).toSet(),
                )
                "monthly" -> ScheduleRule.Monthly(
                    localTime = LocalTime.parse(json.getString("localTime")),
                    dayOfMonth = json.getInt("dayOfMonth"),
                )
                "yearly" -> ScheduleRule.Yearly(
                    localTime = LocalTime.parse(json.getString("localTime")),
                    month = json.getInt("month"),
                    dayOfMonth = json.getInt("dayOfMonth"),
                )
                "custom" -> ScheduleRule.Custom(
                    localTime = LocalTime.parse(json.getString("localTime")),
                    intervalDays = json.getInt("intervalDays"),
                    anchorDate = LocalDate.parse(json.getString("anchorDate")),
                )
                else -> throw BackupFormatException("schedule_rule_unknown_type", "Unknown schedule rule type: $type")
            }
        }
        return reminderId to rule
    }

    private fun formatLocalTime(time: LocalTime): String {
        val text = time.toString()
        return if (text.length == 5) "$text:00" else text
    }

    private fun readIntArray(array: JSONArray): List<Int> = (0 until array.length()).map { array.getInt(it) }
}
