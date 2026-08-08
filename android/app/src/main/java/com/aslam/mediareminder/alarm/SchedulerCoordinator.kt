package com.aslam.mediareminder.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.room.withTransaction
import com.aslam.mediareminder.MainActivity
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.OccurrenceEntity
import com.aslam.mediareminder.data.db.entity.ReminderEntity
import com.aslam.mediareminder.data.db.entity.SchedulerStateEntity
import com.aslam.mediareminder.diagnostics.NativeLogger
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.time.Instant
import java.time.ZoneId
import java.util.UUID

/**
 * ADR-005: "Schedule only the globally earliest due occurrence." ADR-006:
 * exact when authorized, inexact (Limited) fallback otherwise, transparently.
 * ADR-007: no polling, no timer — this class runs only when explicitly
 * invoked (after a reminder save/enable/delete, an alarm action, boot, or a
 * `TIME_SET`/`TIMEZONE_CHANGED` broadcast), never on an interval.
 *
 * Implements the exact six-step algorithm from MR-06 "Scheduling
 * architecture":
 *
 *  1. resolve stale sessions + query the earliest eligible occurrence
 *     (here: ensure every active reminder has a pending occurrence, then
 *     read the earliest one);
 *  2. persist `scheduler_state` desired fields (the outbox's "intent" half);
 *  3. cancel the previous alarm identity if it changed;
 *  4. `setAlarmClock()` when exact access is available;
 *  5. `setAndAllowWhileIdle()` otherwise (Limited, transparently labeled —
 *     see the module doc on scope: full opt-in consent UI is deferred,
 *     documented in docs/decision-log.md);
 *  6. cancel and clear `scheduler_state` when nothing is eligible.
 *
 * A [Mutex], not a database lock, serializes concurrent callers within this
 * process (MR-07 "Concurrency model": "Schedule calculation is pure and
 * deterministic, called within a coordinator lock/mutex") — two receivers
 * racing to reconcile at once must not both register conflicting alarms.
 */
class SchedulerCoordinator(
    private val context: Context,
    private val database: MediaReminderDatabase,
) {
    private val mutex = Mutex()
    private val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

    /**
     * Recomputes and re-registers the single global alarm. Safe to call from
     * any coroutine, any number of times, for any [reason] — reconciliation
     * is idempotent by construction (the outbox generation only advances
     * when the desired state actually changes downstream in
     * [markDesiredAndDiff]).
     */
    suspend fun reconcile(reason: String) = mutex.withLock { reconcileLocked(reason) }

    /**
     * MR-06 "Time and timezone changes": a `TIME_SET`/`TIMEZONE_CHANGED`
     * broadcast must invalidate and recompute derived (non-`once`) pending
     * occurrences *before* the normal reconcile pass runs, since their
     * stored `scheduled_at` was calculated against the zone/clock that just
     * changed. [SystemEventReceiver] is the only caller.
     */
    suspend fun reconcileAfterClockChange(reason: String) = mutex.withLock {
        database.occurrenceDao().invalidatePendingFollowDeviceOccurrences()
        reconcileLocked(reason)
    }

    private suspend fun reconcileLocked(reason: String) {
        val zoneId = ZoneId.systemDefault()
        val now = Instant.now()

        ensurePendingOccurrencesExist(zoneId, now)

        val earliest = database.occurrenceDao().getEarliestEligible()
        applyToAlarmManager(earliest, now, reason)
    }

    /**
     * Step 1 (the "ensure" half): every reminder that is enabled, active and
     * currently missing a pending/claimed occurrence gets the next one
     * computed via [OccurrenceCalculator] and inserted. This is what makes
     * "reschedule automatically" true after an occurrence resolves, not just
     * after an explicit save — the coordinator notices the gap on its next
     * invocation (which the repository always triggers after resolving an
     * action) and fills it.
     *
     * A `once` reminder whose instant has already passed produces no next
     * occurrence ([OccurrenceCalculator] returns `null`); such a reminder is
     * archived here rather than left silently un-rescheduled forever.
     */
    private suspend fun ensurePendingOccurrencesExist(zoneId: ZoneId, now: Instant) {
        database.withTransaction {
            val reminderDao = database.reminderDao()
            val scheduleRuleDao = database.scheduleRuleDao()
            val occurrenceDao = database.occurrenceDao()

            // SQL-filtered instead of getAll()+Kotlin filter, and the two
            // per-reminder lookups below (rule, pending-occurrence check)
            // are batched into one query each rather than N queries each —
            // this loop used to issue up to 2N+1 queries per reconcile pass
            // for N active reminders (docs/decision-log.md).
            val activeReminders = reminderDao.getActive()
            if (activeReminders.isEmpty()) return@withTransaction

            val activeReminderIds = activeReminders.map { it.id }
            val rulesByReminderId = scheduleRuleDao.getByReminderIds(activeReminderIds).associateBy { it.reminderId }
            val reminderIdsWithPending = occurrenceDao.getReminderIdsWithPendingOccurrence(activeReminderIds).toSet()

            for (reminder in activeReminders) {
                if (reminder.id in reminderIdsWithPending) {
                    continue
                }
                val ruleEntity = rulesByReminderId[reminder.id] ?: continue
                val rule = ScheduleRuleMapper.toDomain(ruleEntity)
                val nextInstant = OccurrenceCalculator.nextOccurrence(rule, zoneId, now)

                if (nextInstant == null) {
                    // `once` already elapsed with nothing left to schedule.
                    // Archiving (not deleting) preserves it for Today/history
                    // per MR-09's retention model.
                    reminderDao.update(
                        reminder.copy(effectiveState = ReminderEntity.STATE_ARCHIVED, updatedAt = now.toEpochMilli()),
                    )
                    continue
                }

                val occurrenceKey = OccurrenceEntity.occurrenceKeyFor(
                    OccurrenceEntity.KIND_BASE,
                    nextInstant.toEpochMilli(),
                )
                // Unique (reminder_id, occurrence_key) — MR-09's replay guard.
                // A second reconcile pass for the same instant simply finds
                // nothing to insert (`IGNORE` conflict strategy) rather than
                // erroring.
                occurrenceDao.insert(
                    OccurrenceEntity(
                        id = UUID.randomUUID().toString(),
                        reminderId = reminder.id,
                        kind = OccurrenceEntity.KIND_BASE,
                        scheduledAt = nextInstant.toEpochMilli(),
                        occurrenceKey = occurrenceKey,
                        state = OccurrenceEntity.STATE_PENDING,
                        createdAt = now.toEpochMilli(),
                    ),
                )
            }
        }
    }

    /** Steps 2-6: the outbox write, then the actual `AlarmManager` call. */
    private suspend fun applyToAlarmManager(earliest: OccurrenceEntity?, now: Instant, reason: String) {
        val stateDao = database.schedulerStateDao()
        stateDao.seedIfAbsent(
            SchedulerStateEntity(
                desiredOccurrenceId = null,
                desiredAt = null,
                desiredGeneration = 0,
                appliedGeneration = 0,
                pendingIntentRequestCode = 0,
                isExact = true,
                lastReconcileAt = now.toEpochMilli(),
                lastReason = reason,
                lastErrorCode = null,
            ),
        )
        stateDao.markDesired(earliest?.id, earliest?.scheduledAt, now.toEpochMilli(), reason)
        val state = requireNotNull(stateDao.get()) { "scheduler_state row must exist (seeded at first save)" }

        val pendingIntent = duePendingIntent(earliest, state.desiredGeneration)

        if (earliest == null) {
            // Step 6: nothing eligible — cancel and clear.
            alarmManager.cancel(pendingIntent)
            stateDao.markApplied(state.desiredGeneration, AlarmIds.DUE_ALARM_REQUEST_CODE, isExact = true, now.toEpochMilli())
            DirectBootEnvelopeStore.clear(context)
            NativeLogger.debug("scheduler.cleared", mapOf("reason" to reason))
            return
        }

        // Step 3: `AlarmManager.set*` with the same request code implicitly
        // replaces any previously-registered alarm on that PendingIntent —
        // there is no separate "cancel first" step needed when the identity
        // (request code) is stable, only when the target disappears entirely
        // (handled by the branch above).
        val exact = ExactAlarmAccess.isAvailable(context)
        try {
            if (exact) {
                // Step 4: ADR-006 — `setAlarmClock()` for user-visible exact
                // alarms; the show-intent opens Reminders so the OS's own alarm
                // affordances (lock-screen icon, "next alarm" surfaces) point
                // somewhere meaningful.
                alarmManager.setAlarmClock(
                    AlarmManager.AlarmClockInfo(earliest.scheduledAt, showIntent()),
                    pendingIntent,
                )
            } else {
                // Step 5: Limited mode. MR-06 ADR-006 calls for an explicit user
                // choice between Limited and "Needs setup" before falling back
                // here; that consent UI is out of this pass's scope (see
                // docs/decision-log.md) — this coordinator always keeps *some*
                // alarm registered rather than silently dropping the reminder,
                // which is the safer failure mode of the two while that UI does
                // not exist yet. The capability snapshot (`exact_alarm: limited`)
                // still tells the user the truth about timing precision.
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, earliest.scheduledAt, pendingIntent)
            }
        } catch (error: SecurityException) {
            // `ExactAlarmAccess.isAvailable` and this call are two separate
            // steps — the exact-alarm permission can be revoked (user backs
            // out of Settings, OEM auto-revoke) in the gap between them.
            // `scheduler_state.last_error_code` (`markError`, previously
            // written but never called — docs/decision-log.md) is what makes
            // that failure observable instead of a silently un-armed alarm;
            // rethrown so existing callers' error handling is unchanged.
            stateDao.markError(now.toEpochMilli(), "alarm_manager_security_exception")
            NativeLogger.error("scheduler.applyFailed", mapOf("reason" to reason, "exact" to exact), cause = error)
            throw error
        }

        stateDao.markApplied(state.desiredGeneration, AlarmIds.DUE_ALARM_REQUEST_CODE, exact, now.toEpochMilli())
        // ADR-017: mirror the (label-free) due instant into device-protected
        // storage on every successful apply, so a reboot before this app
        // process ever runs again still has something to arm pre-unlock.
        DirectBootEnvelopeStore.write(context, earliest.scheduledAt, state.desiredGeneration)
        NativeLogger.debug(
            "scheduler.applied",
            mapOf("reason" to reason, "exact" to exact, "generation" to state.desiredGeneration),
        )
    }

    private fun duePendingIntent(earliest: OccurrenceEntity?, generation: Long): PendingIntent {
        val intent = Intent(context, AlarmDispatchReceiver::class.java).apply {
            action = AlarmIds.ACTION_ALARM_DUE
            // Stable extras only when there is a real target; a cancel-only
            // call still needs a structurally-identical Intent to match the
            // previously-registered PendingIntent for `cancel()` to find it.
            putExtra(AlarmIds.EXTRA_GENERATION, generation)
            if (earliest != null) {
                putExtra(AlarmIds.EXTRA_OCCURRENCE_ID, earliest.id)
                putExtra(AlarmIds.EXTRA_REMINDER_ID, earliest.reminderId)
            }
        }
        return PendingIntent.getBroadcast(
            context,
            AlarmIds.DUE_ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    private fun showIntent(): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        return PendingIntent.getActivity(
            context,
            AlarmIds.DUE_ALARM_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }
}
