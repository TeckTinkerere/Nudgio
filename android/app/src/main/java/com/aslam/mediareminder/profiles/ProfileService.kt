package com.aslam.mediareminder.profiles

import android.database.sqlite.SQLiteConstraintException
import androidx.room.withTransaction
import com.aslam.mediareminder.bridge.wire.Arguments
import com.aslam.mediareminder.bridge.wire.ReadableMap
import com.aslam.mediareminder.bridge.wire.WritableArray
import com.aslam.mediareminder.bridge.wire.WritableMap
import com.aslam.mediareminder.data.ReminderProfileSeed
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.ReminderProfileEntity
import java.util.UUID

/**
 * Reads and writes alert profiles (DL-123). Every decision is
 * [ProfileRules]'; this class is the Room half.
 *
 * A profile's values are read when an alarm fires (`AlarmDispatchReceiver`,
 * `AlarmRingingService`), never copied into the schedule, so saving one needs
 * no rescheduling: the next alarm simply uses the new values.
 */
class ProfileService(
    private val database: MediaReminderDatabase,
    private val now: () -> Long = System::currentTimeMillis,
    private val newId: () -> String = { UUID.randomUUID().toString() },
) {
    sealed class Outcome {
        data class Success(val result: WritableMap) : Outcome()
        data class Invalid(val field: String) : Outcome()
        object Conflict : Outcome()
    }

    suspend fun list(): WritableArray {
        val profiles = database.reminderProfileDao().getAll()
        // First creation seeds asynchronously; show the defaults during that
        // one window instead of an empty picker.
        if (profiles.isEmpty()) return ReminderProfileSeed.asWritableArray()
        val usage = database.reminderDao().countPerProfile().associate { it.profileId to it.reminderCount }
        return Arguments.createArray().apply {
            profiles.forEach { pushMap(dto(it, usage[it.id] ?: 0)) }
        }
    }

    suspend fun save(request: ReadableMap): Outcome {
        val input = ProfileRules.Input(
            id = string(request, "id"),
            name = string(request, "name"),
            fullScreenWhenLocked = boolean(request, "fullScreenWhenLocked"),
            timeoutSeconds = int(request, "timeoutSeconds"),
            retryCount = int(request, "retryCount"),
            graceSeconds = int(request, "graceSeconds"),
            defaultSnoozeMinutes = int(request, "defaultSnoozeMinutes"),
            expectedEntityVersion = int(request, "expectedEntityVersion"),
        )
        return database.withTransaction {
            val dao = database.reminderProfileDao()
            val existing = input.id?.let { dao.getById(it) }
            when (val plan = ProfileRules.planSave(input, existing, dao.getAll(), newId(), now())) {
                is ProfileRules.SavePlan.Insert -> {
                    dao.insert(plan.profile)
                    Outcome.Success(dto(plan.profile, 0))
                }
                is ProfileRules.SavePlan.Update -> {
                    dao.update(plan.profile)
                    Outcome.Success(dto(plan.profile, database.reminderDao().countByProfile(plan.profile.id)))
                }
                is ProfileRules.SavePlan.Invalid -> Outcome.Invalid(plan.field)
                ProfileRules.SavePlan.Conflict -> Outcome.Conflict
                ProfileRules.SavePlan.NotFound -> Outcome.Invalid("id")
            }
        }
    }

    suspend fun resetBuiltIn(id: String): Outcome = database.withTransaction {
        val dao = database.reminderProfileDao()
        val reset = ProfileRules.planReset(dao.getById(id), now())
            ?: return@withTransaction Outcome.Invalid("id")
        dao.update(reset)
        Outcome.Success(dto(reset, database.reminderDao().countByProfile(id)))
    }

    suspend fun delete(id: String): Outcome {
        return try {
            database.withTransaction {
                val dao = database.reminderProfileDao()
                val check = ProfileRules.checkDelete(dao.getById(id), database.reminderDao().countByProfile(id))
                when (check) {
                    ProfileRules.DeleteCheck.ALLOWED -> {
                        val removed = dao.deleteCustomById(id)
                        Outcome.Success(
                            Arguments.createMap().apply {
                                putString("status", "ok")
                                putInt("affectedCount", removed)
                            },
                        )
                    }
                    ProfileRules.DeleteCheck.NOT_FOUND, ProfileRules.DeleteCheck.BUILT_IN -> Outcome.Invalid("id")
                    ProfileRules.DeleteCheck.IN_USE -> Outcome.Invalid("inUse")
                }
            }
        } catch (_: SQLiteConstraintException) {
            // A reminder took this profile between the count and the delete:
            // the foreign key (ON DELETE RESTRICT) refused, which is the right answer.
            Outcome.Invalid("inUse")
        }
    }

    private fun dto(profile: ReminderProfileEntity, reminderCount: Int): WritableMap =
        Arguments.createMap().apply {
            putString("id", profile.id)
            putString("nameKey", profile.nameKey)
            putBoolean("isBuiltIn", profile.isBuiltIn)
            putBoolean("fullScreenWhenLocked", profile.fullScreenWhenLocked)
            putInt("timeoutSeconds", profile.timeoutSeconds)
            putInt("retryCount", profile.retryCount)
            putInt("graceSeconds", profile.graceSeconds)
            putInt("defaultSnoozeMinutes", profile.defaultSnoozeMinutes)
            putInt("entityVersion", profile.entityVersion)
            // ADR-018: "Profile edits show affected count."
            putInt("reminderCount", reminderCount)
        }

    // A missing or wrongly typed field reads as null, so the planner names it
    // instead of the bridge failing with an unexplained cast error.
    private fun present(map: ReadableMap, key: String) = map.hasKey(key) && !map.isNull(key)

    private fun string(map: ReadableMap, key: String): String? =
        if (present(map, key)) runCatching { map.getString(key) }.getOrNull() else null

    private fun boolean(map: ReadableMap, key: String): Boolean? =
        if (present(map, key)) runCatching { map.getBoolean(key) }.getOrNull() else null

    private fun int(map: ReadableMap, key: String): Int? {
        if (!present(map, key)) return null
        val value = runCatching { map.getDouble(key) }.getOrNull() ?: return null
        // 2.5 retries or 1e12 seconds is not a number this field can hold.
        return if (value == Math.floor(value) && value in Int.MIN_VALUE.toDouble()..Int.MAX_VALUE.toDouble()) {
            value.toInt()
        } else {
            null
        }
    }
}
