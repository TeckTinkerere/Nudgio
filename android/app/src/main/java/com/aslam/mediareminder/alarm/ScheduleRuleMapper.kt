package com.aslam.mediareminder.alarm

import com.aslam.mediareminder.data.db.entity.ScheduleRuleEntity
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime

/**
 * [ScheduleRuleEntity]'s flattened, nullable-column row <-> the typed
 * [ScheduleRule] domain model [OccurrenceCalculator] actually operates on.
 * One mapper, used by [SchedulerCoordinator] (reading) and
 * `MediaReminderModule.saveReminder` (writing, via the JS
 * `ScheduleRuleDto` -> this entity shape).
 */
object ScheduleRuleMapper {

    fun toDomain(entity: ScheduleRuleEntity): ScheduleRule =
        when (ScheduleRuleEntity.Type.fromWireValue(entity.type)) {
            ScheduleRuleEntity.Type.ONCE -> ScheduleRule.Once(
                instant = Instant.ofEpochMilli(
                    requireNotNull(entity.onceInstantEpochMs) { "once rule missing instant" },
                ),
                originZone = entity.onceOriginZone ?: "UTC",
            )

            ScheduleRuleEntity.Type.DAILY -> ScheduleRule.Daily(
                localTime = localTimeOf(entity),
            )

            ScheduleRuleEntity.Type.WEEKDAYS -> ScheduleRule.Weekly(
                localTime = localTimeOf(entity),
                isoWeekdays = weekdaysFromMask(
                    requireNotNull(entity.isoWeekdaysMask) { "weekdays rule missing mask" },
                ),
            )

            ScheduleRuleEntity.Type.MONTHLY -> ScheduleRule.Monthly(
                localTime = localTimeOf(entity),
                dayOfMonth = requireNotNull(entity.dayOfMonth) { "monthly rule missing dayOfMonth" },
            )

            ScheduleRuleEntity.Type.YEARLY -> ScheduleRule.Yearly(
                localTime = localTimeOf(entity),
                month = requireNotNull(entity.month) { "yearly rule missing month" },
                dayOfMonth = requireNotNull(entity.dayOfMonth) { "yearly rule missing dayOfMonth" },
            )

            ScheduleRuleEntity.Type.CUSTOM -> ScheduleRule.Custom(
                localTime = localTimeOf(entity),
                intervalDays = requireNotNull(entity.intervalDays) { "custom rule missing intervalDays" },
                anchorDate = LocalDate.ofEpochDay(
                    requireNotNull(entity.anchorEpochDay) { "custom rule missing anchorDate" },
                ),
            )
        }

    fun toEntity(reminderId: String, rule: ScheduleRule): ScheduleRuleEntity = when (rule) {
        is ScheduleRule.Once -> ScheduleRuleEntity(
            reminderId = reminderId,
            type = ScheduleRuleEntity.Type.ONCE.wireValue,
            onceInstantEpochMs = rule.instant.toEpochMilli(),
            onceOriginZone = rule.originZone,
        )

        is ScheduleRule.Daily -> ScheduleRuleEntity(
            reminderId = reminderId,
            type = ScheduleRuleEntity.Type.DAILY.wireValue,
            localTimeSecondsOfDay = rule.localTime.toSecondOfDay(),
        )

        is ScheduleRule.Weekly -> ScheduleRuleEntity(
            reminderId = reminderId,
            type = ScheduleRuleEntity.Type.WEEKDAYS.wireValue,
            localTimeSecondsOfDay = rule.localTime.toSecondOfDay(),
            isoWeekdaysMask = maskFromWeekdays(rule.isoWeekdays),
        )

        is ScheduleRule.Monthly -> ScheduleRuleEntity(
            reminderId = reminderId,
            type = ScheduleRuleEntity.Type.MONTHLY.wireValue,
            localTimeSecondsOfDay = rule.localTime.toSecondOfDay(),
            dayOfMonth = rule.dayOfMonth,
        )

        is ScheduleRule.Yearly -> ScheduleRuleEntity(
            reminderId = reminderId,
            type = ScheduleRuleEntity.Type.YEARLY.wireValue,
            localTimeSecondsOfDay = rule.localTime.toSecondOfDay(),
            month = rule.month,
            dayOfMonth = rule.dayOfMonth,
        )

        is ScheduleRule.Custom -> ScheduleRuleEntity(
            reminderId = reminderId,
            type = ScheduleRuleEntity.Type.CUSTOM.wireValue,
            localTimeSecondsOfDay = rule.localTime.toSecondOfDay(),
            intervalDays = rule.intervalDays,
            anchorEpochDay = rule.anchorDate.toEpochDay(),
        )
    }

    private fun localTimeOf(entity: ScheduleRuleEntity): LocalTime =
        LocalTime.ofSecondOfDay(
            requireNotNull(entity.localTimeSecondsOfDay) { "rule of type ${entity.type} missing localTime" }.toLong(),
        )

    /** Bit 0 = Monday ... bit 6 = Sunday, i.e. bit (isoWeekday - 1). */
    private fun maskFromWeekdays(weekdays: Set<Int>): Int =
        weekdays.fold(0) { mask, isoWeekday -> mask or (1 shl (isoWeekday - 1)) }

    private fun weekdaysFromMask(mask: Int): Set<Int> =
        (1..7).filter { isoWeekday -> (mask shr (isoWeekday - 1)) and 1 == 1 }.toSet()
}
