package com.aslam.mediareminder.data.db.entity

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.PrimaryKey

/**
 * MR-09 `schedule_rules` table: "One-to-one with reminder in v1." The
 * primary key *is* the reminder id (no surrogate key), which is what makes
 * the one-to-one relationship a database-level guarantee rather than a
 * convention.
 *
 * "Check constraints ensure only relevant fields are set for each type" per
 * MR-09 — Room has no declarative `CHECK` annotation, so that invariant is
 * enforced in Kotlin at the single write path (`ReminderRepository.save()`,
 * via [Type.requireFieldsFor]) rather than at the SQL layer. Every column
 * below documents which [Type] values populate it.
 *
 * Six repeat types: the original MR-08 baseline (`once`/`daily`/`weekdays`)
 * plus `monthly`/`yearly`/`custom`, added for the recurrence engine
 * (docs/decision-log.md DL-005) and computed by
 * [com.aslam.mediareminder.alarm.OccurrenceCalculator].
 */
@Entity(
    tableName = "schedule_rules",
    foreignKeys = [
        ForeignKey(
            entity = ReminderEntity::class,
            parentColumns = ["id"],
            childColumns = ["reminder_id"],
            onDelete = ForeignKey.CASCADE,
        ),
    ],
)
data class ScheduleRuleEntity(
    @PrimaryKey
    @ColumnInfo(name = "reminder_id")
    val reminderId: String,

    @ColumnInfo(name = "type")
    val type: String,

    // --- `once` only ---------------------------------------------------------
    @ColumnInfo(name = "once_instant_epoch_ms")
    val onceInstantEpochMs: Long? = null,

    /** IANA zone id the user picked the instant in (MR-09/MR-13: "does not move when timezone changes"). */
    @ColumnInfo(name = "once_origin_zone")
    val onceOriginZone: String? = null,

    // --- `daily` / `weekdays` / `monthly` / `yearly` / `custom` --------------
    /** Seconds since local midnight. Absent only for `once`. */
    @ColumnInfo(name = "local_time_seconds_of_day")
    val localTimeSecondsOfDay: Int? = null,

    // --- `weekdays` only -------------------------------------------------------
    /** Bitmask, bit 0 = Monday ... bit 6 = Sunday (ISO weekday - 1). */
    @ColumnInfo(name = "iso_weekdays_mask")
    val isoWeekdaysMask: Int? = null,

    // --- `monthly` / `yearly` ---------------------------------------------------
    /** 1-31; clamped to the actual month length at calculation time, never at write time. */
    @ColumnInfo(name = "day_of_month")
    val dayOfMonth: Int? = null,

    // --- `yearly` only -----------------------------------------------------------
    /** 1-12. */
    @ColumnInfo(name = "month")
    val month: Int? = null,

    // --- `custom` only -------------------------------------------------------------
    /** N >= 1. */
    @ColumnInfo(name = "interval_days")
    val intervalDays: Int? = null,

    /** Epoch day ([java.time.LocalDate.toEpochDay]) the interval counts from. */
    @ColumnInfo(name = "anchor_epoch_day")
    val anchorEpochDay: Long? = null,

    // --- all repeating types -----------------------------------------------------
    /** Always `"follow_device"` today; stored for forward compatibility (MR-08). */
    @ColumnInfo(name = "zone_policy", defaultValue = "follow_device")
    val zonePolicy: String = "follow_device",

    @ColumnInfo(name = "rule_version", defaultValue = "1")
    val ruleVersion: Int = 1,
) {
    enum class Type(val wireValue: String) {
        ONCE("once"),
        DAILY("daily"),
        WEEKDAYS("weekdays"),
        MONTHLY("monthly"),
        YEARLY("yearly"),
        CUSTOM("custom"),
        ;

        companion object {
            fun fromWireValue(value: String): Type =
                entries.find { it.wireValue == value }
                    ?: throw IllegalArgumentException("Unknown schedule rule type: $value")
        }
    }
}
