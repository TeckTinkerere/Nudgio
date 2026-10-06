package com.aslam.mediareminder.reminders

import android.content.Context
import androidx.room.withTransaction
import com.aslam.mediareminder.alarm.ExactAlarmAccess
import com.aslam.mediareminder.alarm.ScheduleRuleMapper
import com.aslam.mediareminder.alarm.SchedulerCoordinator
import com.aslam.mediareminder.alarm.ScheduleRule
import com.aslam.mediareminder.alarm.TestAlarmScheduler
import com.aslam.mediareminder.data.PreferencesRepository
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.OccurrenceEntity
import com.aslam.mediareminder.data.db.entity.ReminderEntity
import com.aslam.mediareminder.media.MediaStorage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import java.time.Instant
import java.util.UUID

/**
 * Backs `MediaReminderModule`'s reminder-CRUD and enable/disable methods
 * (MR-08 "Reminder DTOs"). Room writes, [SchedulerCoordinator.reconcile]
 * calls and DTO assembly all live here rather than in the bridge module
 * itself, so the module stays a thin `ReadableMap`-in/`Promise`-out layer
 * (matching the pattern the rest of `MediaReminderModule` already follows —
 * `PreferencesRepository`, `CapabilitySnapshotProvider`).
 */
class ReminderMutationService(
    private val context: Context,
    private val database: MediaReminderDatabase,
    private val storage: MediaStorage = MediaStorage(context),
) {
    private val scheduler = SchedulerCoordinator(context, database)
    private val preferences = PreferencesRepository(context)

    sealed class SaveOutcome {
        data class Success(val result: WritableMap) : SaveOutcome()
        data class Invalid(val field: String) : SaveOutcome()

        /** MR-08 "Event ordering and idempotency": a stale `entityVersion` is rejected, never silently overwritten. */
        object Conflict : SaveOutcome()
    }

    sealed class EnableOutcome {
        data class Success(val result: WritableMap) : EnableOutcome()
        object NotFound : EnableOutcome()
    }

    sealed class SkipOutcome {
        data class Success(val result: WritableMap) : SkipOutcome()
        object NotFound : SkipOutcome()

        /** One-time reminders cannot skip: their next occurrence is their only one. */
        object NotRepeating : SkipOutcome()

        /** Nothing is waiting to be skipped (disabled, paused, or already ringing). */
        object NothingPending : SkipOutcome()
    }

    suspend fun get(id: String): WritableMap? {
        val reminder = database.reminderDao().getById(id) ?: return null
        val rule = database.scheduleRuleDao().getByReminderId(id) ?: return null
        val nextOccurrence = database.occurrenceDao().getPendingForReminder(id)
        val media = database.mediaDao().getById(reminder.mediaId)
        return ReminderDtoWriter.writeDetail(reminder, rule, nextOccurrence, media, storage, skippedFor(id))
    }

    /** The latest future "Skip next" for [reminderId], shown as "Skipping ..." with an undo. */
    private suspend fun skippedFor(reminderId: String): OccurrenceEntity? =
        database.occurrenceDao().getFutureSkipped(listOf(reminderId), Instant.now().toEpochMilli())
            .maxByOrNull { it.scheduledAt }

    suspend fun list(): WritableMap {
        val reminders = database.reminderDao().getAll()
        val reminderIds = reminders.map { it.id }
        // Batched instead of two per-reminder queries in a loop — this used
        // to be a 2N+1-query list endpoint for N reminders (docs/decision-log.md).
        val rulesByReminderId = database.scheduleRuleDao().getByReminderIds(reminderIds).associateBy { it.reminderId }
        val nextOccurrenceByReminderId = database.occurrenceDao().getPendingForReminders(reminderIds).associateBy { it.reminderId }
        val mediaByMediaId = database.mediaDao().getByIds(reminders.map { it.mediaId }.distinct()).associateBy { it.id }
        val skippedByReminderId = database.occurrenceDao().getFutureSkipped(reminderIds, Instant.now().toEpochMilli())
            .groupBy { it.reminderId }
            .mapValues { (_, rows) -> rows.maxBy { it.scheduledAt } }

        val items = Arguments.createArray()
        var count = 0
        for (reminder in reminders) {
            val rule = rulesByReminderId[reminder.id] ?: continue
            val nextOccurrence = nextOccurrenceByReminderId[reminder.id]
            val media = mediaByMediaId[reminder.mediaId]
            items.pushMap(
                ReminderDtoWriter.writeSummary(reminder, rule, nextOccurrence, media, storage, skippedByReminderId[reminder.id]),
            )
            count += 1
        }
        return Arguments.createMap().apply {
            putArray("items", items)
            putInt("total", count)
            putInt("offset", 0)
            putBoolean("hasMore", false)
        }
    }

    suspend fun save(request: ReadableMap): SaveOutcome {
        val mediaId = request.getString("mediaId") ?: return SaveOutcome.Invalid("mediaId")
        val label = request.getString("label")?.trim().orEmpty()
        if (label.isEmpty()) return SaveOutcome.Invalid("label")
        val profileId = request.getString("profileId") ?: return SaveOutcome.Invalid("profileId")
        if (database.reminderProfileDao().getById(profileId) == null) return SaveOutcome.Invalid("profileId")

        val scheduleMap = request.getMap("schedule") ?: return SaveOutcome.Invalid("schedule")
        val rule = try {
            ScheduleRuleBridge.readRule(scheduleMap)
        } catch (error: Exception) {
            return SaveOutcome.Invalid("schedule")
        }

        val snoozeMap = request.getMap("snooze") ?: return SaveOutcome.Invalid("snooze")
        if (!snoozeMap.hasKey("defaultMinutes") || !snoozeMap.hasKey("minimumMinutes") || !snoozeMap.hasKey("maximumMinutes")) {
            return SaveOutcome.Invalid("snooze")
        }

        val enabledIntent = if (request.hasKey("enabledIntent")) request.getBoolean("enabledIntent") else true
        val notes = if (request.hasKey("notes")) request.getString("notes")?.trim()?.takeIf { it.isNotEmpty() } else null
        if (notes != null && notes.length > MAX_MESSAGE_LENGTH) return SaveOutcome.Invalid("notes")
        val requestedHistory = if (request.hasKey("historyEnabled")) request.getBoolean("historyEnabled") else null
        // Null or 0 both mean "from the beginning"; stored as null.
        val mediaStartMs = if (request.hasKey("mediaStartMs") && !request.isNull("mediaStartMs")) {
            request.getDouble("mediaStartMs").toLong().takeIf { it in 0..MAX_MEDIA_START_MS }
                ?: return SaveOutcome.Invalid("mediaStartMs")
        } else {
            null
        }?.takeIf { it > 0 }

        // Absent or null `action` means "no action" — the editor always sends
        // the whole reminder, so this is also how an action is removed.
        val actionMap = if (request.hasKey("action") && !request.isNull("action")) request.getMap("action") else null
        val action = when (
            val resolved = ReminderActionRules.validate(
                type = actionMap?.takeIf { it.hasKey("type") }?.getString("type"),
                uri = actionMap?.takeIf { it.hasKey("uri") }?.getString("uri"),
                label = actionMap?.takeIf { it.hasKey("label") && !it.isNull("label") }?.getString("label"),
            )
        ) {
            is ReminderActionRules.Result.Invalid -> return SaveOutcome.Invalid(resolved.field)
            is ReminderActionRules.Result.Ok -> resolved.action
        }
        val requestedId = if (request.hasKey("id")) request.getString("id") else null
        val requestedVersion = if (request.hasKey("entityVersion")) request.getDouble("entityVersion").toInt() else null

        val reminderDao = database.reminderDao()
        val existing = requestedId?.let { reminderDao.getById(it) }
        if (requestedId != null && existing == null) return SaveOutcome.Invalid("id")
        if (existing != null && requestedVersion != null && existing.entityVersion != requestedVersion) {
            return SaveOutcome.Conflict
        }

        val now = Instant.now().toEpochMilli()
        val reminderId = existing?.id ?: requestedId ?: UUID.randomUUID().toString()
        val effectiveState = if (enabledIntent) ReminderEntity.STATE_ACTIVE else ReminderEntity.STATE_DISABLED

        val entity = ReminderEntity(
            id = reminderId,
            mediaId = mediaId,
            profileId = profileId,
            label = label,
            notes = notes,
            enabledIntent = enabledIntent,
            effectiveState = effectiveState,
            snoozeDefaultMinutes = snoozeMap.getInt("defaultMinutes"),
            snoozeAllowCustom = if (snoozeMap.hasKey("allowCustom")) snoozeMap.getBoolean("allowCustom") else true,
            snoozeMinimumMinutes = snoozeMap.getInt("minimumMinutes"),
            snoozeMaximumMinutes = snoozeMap.getInt("maximumMinutes"),
            historyEnabled = requestedHistory ?: existing?.historyEnabled ?: true,
            createdAt = existing?.createdAt ?: now,
            updatedAt = now,
            entityVersion = (existing?.entityVersion ?: 0) + 1,
            actionType = action?.type,
            actionUri = action?.uri,
            actionLabel = action?.label,
            mediaStartMs = mediaStartMs,
        )

        var conflicted = false
        database.withTransaction {
            if (existing == null) {
                reminderDao.insert(entity)
            } else {
                val rows = reminderDao.updateWithVersionCheck(
                    id = entity.id,
                    mediaId = entity.mediaId,
                    profileId = entity.profileId,
                    label = entity.label,
                    notes = entity.notes,
                    enabledIntent = entity.enabledIntent,
                    effectiveState = entity.effectiveState,
                    snoozeDefaultMinutes = entity.snoozeDefaultMinutes,
                    snoozeAllowCustom = entity.snoozeAllowCustom,
                    snoozeMinimumMinutes = entity.snoozeMinimumMinutes,
                    snoozeMaximumMinutes = entity.snoozeMaximumMinutes,
                    historyEnabled = entity.historyEnabled,
                    actionType = entity.actionType,
                    actionUri = entity.actionUri,
                    actionLabel = entity.actionLabel,
                    mediaStartMs = entity.mediaStartMs,
                    updatedAt = entity.updatedAt,
                    expectedVersion = existing.entityVersion,
                )
                if (rows == 0) {
                    // Lost a race against a concurrent save between the
                    // check above and this transaction — same outcome as the
                    // pre-check, just caught at the actually-atomic layer.
                    conflicted = true
                    return@withTransaction
                }
            }
            database.scheduleRuleDao().upsert(ScheduleRuleMapper.toEntity(reminderId, rule))
            // A schedule/media/profile edit invalidates any previously
            // computed pending occurrence; `SchedulerCoordinator.reconcile`
            // (called after this transaction) recomputes a fresh one from
            // the new rule. Only `pending` rows — never one already claimed
            // by an in-flight dispatch (see `deleteUnclaimedPendingForReminder`'s doc).
            database.occurrenceDao().deleteUnclaimedPendingForReminder(reminderId)
            // A skip was of the old schedule's next time; keeping it would
            // silently hold back every new-schedule time before it.
            database.occurrenceDao().deleteFutureSkippedForReminder(reminderId, now)
        }
        if (conflicted) return SaveOutcome.Conflict

        scheduler.reconcile("reminder_saved")

        val savedReminder = requireNotNull(reminderDao.getById(reminderId))
        val savedRule = requireNotNull(database.scheduleRuleDao().getByReminderId(reminderId))
        val nextOccurrence = database.occurrenceDao().getPendingForReminder(reminderId)
        val schedulerGeneration = database.schedulerStateDao().get()?.desiredGeneration ?: 0L
        val media = database.mediaDao().getById(savedReminder.mediaId)

        val result = Arguments.createMap().apply {
            putMap("reminder", ReminderDtoWriter.writeDetail(savedReminder, savedRule, nextOccurrence, media, storage))
            if (nextOccurrence != null) putMap("nextOccurrence", ReminderDtoWriter.writeOccurrence(nextOccurrence)) else putNull("nextOccurrence")
            putMap(
                "capabilityResult",
                Arguments.createMap().apply {
                    if (ExactAlarmAccess.isAvailable(context)) {
                        putString("status", "ok")
                    } else {
                        putString("status", "limited")
                        putString("effectKey", "capability.exactAlarm.limited")
                    }
                },
            )
            putString("schedulerGeneration", schedulerGeneration.toString())
        }
        return SaveOutcome.Success(result)
    }

    suspend fun setEnabled(id: String, enabled: Boolean): EnableOutcome {
        val reminderDao = database.reminderDao()
        reminderDao.getById(id) ?: return EnableOutcome.NotFound

        val now = Instant.now().toEpochMilli()
        val effectiveState = if (enabled) ReminderEntity.STATE_ACTIVE else ReminderEntity.STATE_DISABLED
        database.withTransaction {
            reminderDao.updateEnabled(id, enabled, effectiveState, now)
            if (!enabled) {
                database.occurrenceDao().deleteUnclaimedPendingForReminder(id)
            }
            database.occurrenceDao().deleteFutureSkippedForReminder(id, now)
        }
        scheduler.reconcile(if (enabled) "reminder_enabled" else "reminder_disabled")

        val updated = requireNotNull(reminderDao.getById(id))
        val rule = requireNotNull(database.scheduleRuleDao().getByReminderId(id))
        val nextOccurrence = database.occurrenceDao().getPendingForReminder(id)
        val media = database.mediaDao().getById(updated.mediaId)

        val result = Arguments.createMap().apply {
            putMap("reminder", ReminderDtoWriter.writeSummary(updated, rule, nextOccurrence, media, storage))
            if (nextOccurrence != null) putMap("nextOccurrence", ReminderDtoWriter.writeOccurrence(nextOccurrence)) else putNull("nextOccurrence")
        }
        return EnableOutcome.Success(result)
    }

    /**
     * "Skip next" (DL-110). [skip] resolves the pending occurrence as
     * `skipped`; its row then keeps the scheduler from choosing that instant
     * again, and the reconcile computes the one after. `skip = false` undoes
     * every future skip for this reminder.
     *
     * `resolved_at` is the skipped instant, not now, so the 90-day retention
     * sweep cannot delete a skip of a reminder months ahead before it passes.
     */
    suspend fun skipNext(id: String, skip: Boolean): SkipOutcome {
        val reminder = database.reminderDao().getById(id) ?: return SkipOutcome.NotFound
        val ruleEntity = database.scheduleRuleDao().getByReminderId(id) ?: return SkipOutcome.NotFound
        val occurrenceDao = database.occurrenceDao()
        val now = Instant.now().toEpochMilli()
        if (skip) {
            if (ScheduleRuleMapper.toDomain(ruleEntity) is ScheduleRule.Once) return SkipOutcome.NotRepeating
            val pending = occurrenceDao.getPendingForReminder(id)
                ?.takeIf { it.state == OccurrenceEntity.STATE_PENDING && it.kind == OccurrenceEntity.KIND_BASE }
                ?: return SkipOutcome.NothingPending
            occurrenceDao.resolve(pending.id, OccurrenceEntity.STATE_SKIPPED, action = "skip", resolvedAt = pending.scheduledAt)
            scheduler.reconcile("reminder_skipped")
        } else {
            database.withTransaction {
                occurrenceDao.deleteFutureSkippedForReminder(id, now)
                occurrenceDao.deleteUnclaimedPendingForReminder(id)
            }
            scheduler.reconcile("reminder_unskipped")
        }

        val nextOccurrence = occurrenceDao.getPendingForReminder(id)
        val media = database.mediaDao().getById(reminder.mediaId)
        val result = Arguments.createMap().apply {
            putMap("reminder", ReminderDtoWriter.writeSummary(reminder, ruleEntity, nextOccurrence, media, storage, skippedFor(id)))
            if (nextOccurrence != null) putMap("nextOccurrence", ReminderDtoWriter.writeOccurrence(nextOccurrence)) else putNull("nextOccurrence")
        }
        return SkipOutcome.Success(result)
    }

    /**
     * "Pause all" (DL-110): stores [until] (null resumes) and drops every
     * unclaimed occurrence, so the reconcile recomputes each reminder from
     * the pause's end, or from now on resume. An alarm already ringing is
     * left to finish.
     */
    suspend fun setPausedUntil(until: Instant?) {
        preferences.writePausedUntil(until)
        database.occurrenceDao().deleteAllUnclaimedPending()
        scheduler.reconcile(if (until == null) "pause_ended" else "pause_started")
    }

    /** FK `CASCADE` on `schedule_rules`/`occurrences`/`active_alarm_session` does the rest of the cleanup. */
    suspend fun delete(id: String): WritableMap {
        val deletedRows = database.reminderDao().deleteById(id)
        if (deletedRows > 0) {
            scheduler.reconcile("reminder_deleted")
        }
        return Arguments.createMap().apply {
            putString("status", "ok")
            putInt("affectedCount", deletedRows)
        }
    }

    /**
     * Settings "Preview alarm styles" (MR-03 "Test reminder"): fires in
     * [TEST_DELAY_MS], independent of the single global reminder alarm (a
     * distinct `AlarmManager` request code). `title`/`body` are
     * already-localized strings JS built for the tapped profile;
     * `fullScreenWhenLocked` mirrors that profile's real field.
     */
    fun scheduleTest(title: String, body: String, fullScreenWhenLocked: Boolean): WritableMap {
        val scheduledAt = Instant.now().plusMillis(TEST_DELAY_MS)
        TestAlarmScheduler.schedule(context, scheduledAt, title, body, fullScreenWhenLocked)
        return Arguments.createMap().apply {
            putString("sessionId", UUID.randomUUID().toString())
            putString("scheduledAt", scheduledAt.toString())
        }
    }

    private companion object {
        const val TEST_DELAY_MS = 15_000L

        /** Same 4000-character cap MR-09 already sets for media notes. */
        const val MAX_MESSAGE_LENGTH = 4000

        /** DL-110: a start point beyond six hours is a bad value, not a long film. */
        const val MAX_MEDIA_START_MS = 6L * 60 * 60 * 1000
    }
}
