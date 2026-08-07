package com.aslam.mediareminder.alarm

import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.ActiveAlarmSessionEntity
import com.aslam.mediareminder.data.db.entity.IdempotencyRecordEntity
import com.aslam.mediareminder.data.db.entity.OccurrenceEntity
import java.time.Instant
import java.util.UUID
import kotlin.math.max

/**
 * MR-08 "Alarm action contract": the single implementation of Play/Snooze/
 * Dismiss resolution, shared by [AlarmActionReceiver] (a notification-action
 * tap, no RN bridge involved) and `MediaReminderModule` (an in-app tap on the
 * same session while the RN bridge is alive). AND-002 ("Play/Snooze/Dismiss
 * work with the React Native bridge intentionally disabled") requires both
 * paths to resolve identically; a second hand-written copy of the
 * nonce/idempotency logic would be exactly the drift that guarantee depends
 * on not happening.
 */
object AlarmActionProcessor {

    sealed class Outcome {
        /** @param snoozedUntilEpochMs set only when [actionLabel] is `"snooze"`. */
        data class Resolved(
            val resolvedState: String,
            val actionLabel: String,
            val occurrenceId: String,
            val reminderId: String,
            val snoozedUntilEpochMs: Long?,
        ) : Outcome()

        /** MR-08 `MR_ACTION_ALREADY_RESOLVED`: success-like, not an error. Covers both an exact-nonce replay and a session that is no longer alerting. */
        object AlreadyResolved : Outcome()

        /** Missing session row or a nonce that does not match — rejected outright, never treated as a duplicate of the real action. */
        object UnknownSession : Outcome()
    }

    private const val IDEMPOTENCY_RETENTION_MS = 7L * 24 * 60 * 60 * 1000
    private const val MILLIS_PER_MINUTE = 60_000L

    /**
     * @param requestedSnoozeMinutes an in-app custom snooze duration (only
     *   the RN-bridge caller can supply one — no notification action UI
     *   collects it). Honored only when [action] is `SNOOZE` and the
     *   reminder's [com.aslam.mediareminder.data.db.entity.ReminderEntity.snoozeAllowCustom]
     *   is true; otherwise the reminder's own default is used. Either way the
     *   result is clamped to that reminder's configured min/max — this,
     *   together with the per-reminder default, is the concrete "smart
     *   snooze" interpretation recorded in docs/decision-log.md: the snooze
     *   duration adapts to how *this* reminder was configured rather than
     *   reusing one app-wide constant.
     */
    suspend fun process(
        database: MediaReminderDatabase,
        action: String,
        sessionId: String,
        nonce: String,
        requestedSnoozeMinutes: Int? = null,
    ): Outcome {
        val idempotencyKey = "$sessionId:$nonce"
        // MR-08: an identical replay of an already-resolved action is a
        // silent success-like no-op, not reprocessed. Deliberately checked
        // before the session lookup below, so it also covers a session row
        // already removed by a reminder/occurrence cascade.
        if (database.idempotencyDao().find(IdempotencyRecordEntity.SCOPE_ALARM_ACTION, idempotencyKey) != null) {
            return Outcome.AlreadyResolved
        }

        val session = database.activeAlarmSessionDao().getById(sessionId) ?: return Outcome.UnknownSession
        if (session.actionNonce != nonce) return Outcome.UnknownSession
        if (session.state != ActiveAlarmSessionEntity.STATE_ALERTING) return Outcome.AlreadyResolved

        val now = Instant.now().toEpochMilli()
        val resolvedState = when (action) {
            AlarmIds.ACTION_PLAY -> OccurrenceEntity.STATE_ACCEPTED
            AlarmIds.ACTION_SNOOZE -> OccurrenceEntity.STATE_SNOOZED
            else -> OccurrenceEntity.STATE_DISMISSED
        }
        val actionLabel = when (action) {
            AlarmIds.ACTION_PLAY -> "play"
            AlarmIds.ACTION_SNOOZE -> "snooze"
            else -> "dismiss"
        }

        database.occurrenceDao().resolve(session.occurrenceId, resolvedState, actionLabel, now)
        database.activeAlarmSessionDao().resolve(sessionId, now)

        val snoozedUntil = if (action == AlarmIds.ACTION_SNOOZE) {
            insertSnoozeOccurrence(database, session, now, requestedSnoozeMinutes)
        } else {
            null
        }

        database.idempotencyDao().upsert(
            IdempotencyRecordEntity(
                scope = IdempotencyRecordEntity.SCOPE_ALARM_ACTION,
                key = idempotencyKey,
                requestHash = actionLabel,
                resultSummary = resolvedState,
                createdAt = now,
                expiresAt = now + IDEMPOTENCY_RETENTION_MS,
            ),
        )

        return Outcome.Resolved(resolvedState, actionLabel, session.occurrenceId, session.reminderId, snoozedUntil)
    }

    private suspend fun insertSnoozeOccurrence(
        database: MediaReminderDatabase,
        session: ActiveAlarmSessionEntity,
        now: Long,
        requestedSnoozeMinutes: Int?,
    ): Long? {
        val reminder = database.reminderDao().getById(session.reminderId) ?: return null
        val baseMinutes = if (requestedSnoozeMinutes != null && reminder.snoozeAllowCustom) {
            requestedSnoozeMinutes
        } else {
            reminder.snoozeDefaultMinutes
        }
        val snoozeMinutes = baseMinutes.coerceIn(
            reminder.snoozeMinimumMinutes,
            max(reminder.snoozeMinimumMinutes, reminder.snoozeMaximumMinutes),
        )
        val scheduledAt = now + snoozeMinutes * MILLIS_PER_MINUTE
        val occurrenceKey = OccurrenceEntity.occurrenceKeyFor(OccurrenceEntity.KIND_SNOOZE, scheduledAt)

        database.occurrenceDao().insert(
            OccurrenceEntity(
                id = UUID.randomUUID().toString(),
                reminderId = session.reminderId,
                kind = OccurrenceEntity.KIND_SNOOZE,
                parentOccurrenceId = session.occurrenceId,
                scheduledAt = scheduledAt,
                occurrenceKey = occurrenceKey,
                state = OccurrenceEntity.STATE_PENDING,
                createdAt = now,
            ),
        )
        return scheduledAt
    }
}
