package com.aslam.mediareminder.data.db.dao

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.aslam.mediareminder.data.db.entity.OccurrenceEntity

@Dao
interface OccurrenceDao {
    @Query("SELECT * FROM occurrences WHERE id = :id")
    suspend fun getById(id: String): OccurrenceEntity?

    @Query("SELECT * FROM occurrences WHERE reminder_id = :reminderId AND occurrence_key = :occurrenceKey")
    suspend fun getByReminderAndKey(reminderId: String, occurrenceKey: String): OccurrenceEntity?

    @Query(
        "SELECT * FROM occurrences WHERE reminder_id = :reminderId AND state IN ('pending', 'claimed') ORDER BY scheduled_at ASC LIMIT 1",
    )
    suspend fun getPendingForReminder(reminderId: String): OccurrenceEntity?

    /**
     * Batched variant of [getPendingForReminder] for callers iterating many
     * reminders at once (e.g.
     * [com.aslam.mediareminder.alarm.SchedulerCoordinator]) — one query
     * instead of N. Callers only need the *set* of reminder IDs that already
     * have a pending/claimed occurrence, not the row contents, so this
     * returns just the distinct `reminder_id` values.
     */
    @Query(
        "SELECT DISTINCT reminder_id FROM occurrences WHERE reminder_id IN (:reminderIds) AND state IN ('pending', 'claimed')",
    )
    suspend fun getReminderIdsWithPendingOccurrence(reminderIds: List<String>): List<String>

    /**
     * Batched variant of [getPendingForReminder] for callers listing many
     * reminders at once (e.g. `ReminderMutationService.list`) — one query
     * instead of N. Safe to key the result by `reminder_id` with no
     * secondary ordering: [ensurePendingOccurrencesExist]-style scheduling
     * never leaves more than one `pending`/`claimed` occurrence per reminder
     * at a time, so this is at most one row per ID, same as the
     * single-reminder query.
     */
    @Query(
        "SELECT * FROM occurrences WHERE reminder_id IN (:reminderIds) AND state IN ('pending', 'claimed')",
    )
    suspend fun getPendingForReminders(reminderIds: List<String>): List<OccurrenceEntity>

    /**
     * ADR-005: "Schedule only the globally earliest due occurrence." This is
     * the query that makes that decision — one row, across every enabled
     * reminder, is what [com.aslam.mediareminder.alarm.SchedulerCoordinator]
     * ever registers with `AlarmManager`.
     *
     * `pending` only, not `claimed`: a `claimed` occurrence's alarm has
     * already fired — it is currently alerting/being handled by
     * [com.aslam.mediareminder.alarm.AlarmDispatchReceiver]/`AlarmRingingService`,
     * not something that still needs a *new* `AlarmManager` registration.
     * Including `claimed` here used to mean a still-alerting occurrence
     * (whose `scheduled_at` is necessarily in the past) would keep winning
     * this `ORDER BY scheduled_at ASC` forever, starving a second reminder
     * that becomes due while the first is still being handled — the
     * multiple-simultaneous-reminders case this exact bug blocked
     * (docs/decision-log.md).
     */
    @Query(
        """
        SELECT o.* FROM occurrences o
        INNER JOIN reminders r ON r.id = o.reminder_id
        WHERE o.state = 'pending'
          AND r.enabled_intent = 1
          AND r.effective_state = 'active'
        ORDER BY o.scheduled_at ASC
        LIMIT 1
        """,
    )
    suspend fun getEarliestEligible(): OccurrenceEntity?

    /** All currently-alerting sessions' occurrences, earliest-claimed first — used to recover [com.aslam.mediareminder.alarm.AlarmRingingService]'s queue after process death. */
    @Query(
        """
        SELECT o.* FROM occurrences o
        WHERE o.state = 'claimed'
        ORDER BY o.triggered_at ASC
        """,
    )
    suspend fun getClaimed(): List<OccurrenceEntity>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(occurrence: OccurrenceEntity): Long

    @Query("UPDATE occurrences SET state = :state, triggered_at = :triggeredAt WHERE id = :id AND state IN ('pending', 'claimed')")
    suspend fun claim(id: String, state: String, triggeredAt: Long): Int

    @Query("UPDATE occurrences SET state = :state, action = :action, resolved_at = :resolvedAt WHERE id = :id")
    suspend fun resolve(id: String, state: String, action: String?, resolvedAt: Long)

    @Query("DELETE FROM occurrences WHERE reminder_id = :reminderId AND state IN ('pending', 'claimed')")
    suspend fun deletePendingForReminder(reminderId: String)

    /**
     * The save/enable/disable-safe variant of [deletePendingForReminder]:
     * `claimed` rows are deliberately excluded, so editing a reminder while
     * one of its occurrences is mid-dispatch (claimed, notification already
     * posted) can never cascade-delete the
     * [com.aslam.mediareminder.data.db.entity.ActiveAlarmSessionEntity] a
     * user is actively looking at.
     */
    @Query("DELETE FROM occurrences WHERE reminder_id = :reminderId AND state = 'pending'")
    suspend fun deleteUnclaimedPendingForReminder(reminderId: String): Int

    /**
     * MR-06 "Time and timezone changes": "invalidates derived occurrences
     * beyond the idempotency horizon, recalculates, and registers the next
     * alarm." A `once` reminder's occurrence stores a fixed instant that does
     * not move with the zone (MR-09), so it is excluded here — only rules
     * whose next-due instant was *derived* from a local wall-clock time
     * (`daily`/`weekdays`/`monthly`/`yearly`/`custom`, all `zone_policy =
     * follow_device`) can have gone stale. Only `pending` (not `claimed`)
     * rows are touched, so this can never race an in-flight dispatch.
     * [com.aslam.mediareminder.alarm.SchedulerCoordinator] recomputes a
     * replacement immediately afterward in the same reconcile pass.
     */
    @Query(
        """
        DELETE FROM occurrences
        WHERE state = 'pending'
          AND kind = 'base'
          AND reminder_id IN (
              SELECT reminder_id FROM schedule_rules WHERE type != 'once'
          )
        """,
    )
    suspend fun invalidatePendingFollowDeviceOccurrences(): Int

    /** MR-09 "Data retention": occurrence history defaults to 90 days. */
    @Query("DELETE FROM occurrences WHERE resolved_at IS NOT NULL AND resolved_at < :cutoffEpochMs")
    suspend fun deleteResolvedBefore(cutoffEpochMs: Long): Int
}
