package com.aslam.mediareminder.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.room.withTransaction
import com.aslam.mediareminder.MainActivity
import com.aslam.mediareminder.data.PreferencesRepository
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
    private val preferences = PreferencesRepository(context)

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

        resolveAbandonedAlarms(now)
        // An unreadable preference must never stop reminders being scheduled:
        // ringing during a pause is the lesser failure than not ringing at all.
        val pausedUntil = runCatching { preferences.readPausedUntil(now) }
            .onFailure { NativeLogger.error("scheduler.pauseUnreadable", cause = it) }
            .getOrNull()
        ensurePendingOccurrencesExist(zoneId, now, pausedUntil)

        val earliest = database.occurrenceDao().getEarliestEligible()
        applyToAlarmManager(earliest, now, reason)
    }

    /**
     * Step 1's "resolve stale sessions" half, which this class has documented
     * from the start but never actually did.
     *
     * An occurrence moves to `claimed` the moment [AlarmDispatchReceiver]
     * picks it up, and an `active_alarm_session` row is written `alerting`
     * alongside it. Both are cleared when the user accepts, snoozes or
     * dismisses. If nothing ever does — the process is killed mid-alarm, or
     * `startForegroundService` is refused so [AlarmRingingService] never
     * starts at all — the pair is stranded, and that is fatal for the
     * reminder rather than merely untidy:
     * [OccurrenceDao.getReminderIdsWithPendingOccurrence] counts `claimed`,
     * so [ensurePendingOccurrencesExist] skips the reminder and never
     * computes its next occurrence, while [OccurrenceDao.getEarliestEligible]
     * only considers `pending`, so the stranded row is never scheduled
     * either. The reminder stops firing permanently, every reconcile logs
     * `scheduler.cleared`, and editing the reminder's time does not recover
     * it — [OccurrenceDao.deleteUnclaimedPendingForReminder] spares `claimed`
     * rows on purpose, so that saving can never cancel an alarm that is
     * genuinely ringing at that moment.
     *
     * Two guards keep the sweep from ever silencing a live alarm, and both
     * are needed. [AlarmRingingService.isRunning] is the obvious one: nothing
     * in a service outlives its process, so while one is running it owns its
     * sessions and they are left strictly alone.
     *
     * That alone is not enough, which an earlier version of this method
     * proved by cancelling the very alarm it was dispatching. The dispatch
     * path writes the session, calls `startForegroundService`, and then
     * reconciles — all within the same tick — so the reconcile can land in
     * the window after the session row exists but before `onCreate` has set
     * the flag, and a seconds-old live session looks exactly like a stranded
     * one. Hence the age guard: a session is only considered stranded once it
     * is older than [STALE_AFTER_MILLIS], which is built from
     * [AlarmRingingService.MAX_LIFETIME_SECONDS] — the hard cap the service
     * stops itself at — plus a wide margin. Past that point no session can
     * legitimately still be alerting, and inside it nothing is touched.
     *
     * Stranded occurrences are resolved as `missed` rather than deleted —
     * that is what actually happened to the user, it keeps them in history
     * and in [OccurrenceDao.recentlyMissed], and it frees the reminder to
     * schedule again on the very next line of [reconcileLocked].
     */
    private suspend fun resolveAbandonedAlarms(now: Instant) {
        if (AlarmRingingService.isRunning) return

        val cutoff = now.toEpochMilli() - STALE_AFTER_MILLIS
        val occurrenceDao = database.occurrenceDao()
        val sessionDao = database.activeAlarmSessionDao()
        val stranded = sessionDao.getAllAlerting().filter { it.lastUpdate < cutoff }
        val claimed = occurrenceDao.getAbandonedClaimed(cutoff)
        if (stranded.isEmpty() && claimed.isEmpty()) return

        for (session in stranded) {
            sessionDao.resolve(session.id, now.toEpochMilli())
        }
        // Both sets, de-duplicated: a stranded session's occurrence, plus any
        // occurrence left `claimed` after its session was already resolved.
        val occurrenceIds = (stranded.map { it.occurrenceId } + claimed.map { it.id }).toSet()
        for (occurrenceId in occurrenceIds) {
            occurrenceDao.resolve(
                occurrenceId,
                OccurrenceEntity.STATE_MISSED,
                action = null,
                resolvedAt = now.toEpochMilli(),
            )
        }
        NativeLogger.debug(
            "scheduler.abandonedAlarmsResolved",
            mapOf("sessions" to stranded.size, "occurrences" to occurrenceIds.size),
        )
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
     *
     * DL-110 moves where the search for "next" starts, never what a rule
     * means: it starts after the latest future *skipped* occurrence ("Skip
     * next"), and after [pausedUntil] ("Pause all"). A one-time reminder
     * inside a pause never rings; it is held while its moment is still
     * ahead (so resuming early restores it) and archived once it passes —
     * the pause dialog says so. An indefinite pause
     * computes nothing at all; resuming starts from now.
     */
    private suspend fun ensurePendingOccurrencesExist(zoneId: ZoneId, now: Instant, pausedUntil: Instant?) {
        if (pausedUntil != null && !pausedUntil.isBefore(PreferencesRepository.INDEFINITE_PAUSE)) return
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
            val latestSkipByReminderId = occurrenceDao.getFutureSkipped(activeReminderIds, now.toEpochMilli())
                .groupBy { it.reminderId }
                .mapValues { (_, rows) -> Instant.ofEpochMilli(rows.maxOf { it.scheduledAt }) }

            for (reminder in activeReminders) {
                if (reminder.id in reminderIdsWithPending) {
                    continue
                }
                val ruleEntity = rulesByReminderId[reminder.id] ?: continue
                val rule = ScheduleRuleMapper.toDomain(ruleEntity)
                val searchFrom = listOfNotNull(now, pausedUntil, latestSkipByReminderId[reminder.id]).max()
                val nextInstant = OccurrenceCalculator.nextOccurrence(rule, zoneId, searchFrom)

                // A one-time reminder that falls inside a pause is held, not
                // archived: resuming early must bring it back. Once its
                // moment has passed, the next reconcile archives it as usual.
                if (nextInstant == null && rule is ScheduleRule.Once && rule.instant.isAfter(now)) {
                    continue
                }
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

    private companion object {
        /**
         * How old an `alerting` session must be before [resolveAbandonedAlarms]
         * will treat it as stranded: [AlarmRingingService.MAX_LIFETIME_SECONDS]
         * (the point the service stops itself) plus five minutes of slack for
         * a device that was asleep or heavily throttled. Generous on purpose —
         * being slow to recover a dead session costs one late reminder, while
         * being hasty cancels a live alarm mid-ring.
         */
        const val STALE_AFTER_MILLIS: Long = (AlarmRingingService.MAX_LIFETIME_SECONDS + 300) * 1000L
    }
}
