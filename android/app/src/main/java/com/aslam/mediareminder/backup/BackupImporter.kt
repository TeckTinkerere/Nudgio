package com.aslam.mediareminder.backup

import android.content.Context
import android.net.Uri
import androidx.room.withTransaction
import com.aslam.mediareminder.alarm.SchedulerCoordinator
import com.aslam.mediareminder.alarm.ScheduleRuleMapper
import com.aslam.mediareminder.data.PreferencesRepository
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.MediaAssetEntity
import com.aslam.mediareminder.data.db.entity.OperationJournalEntity
import com.aslam.mediareminder.data.db.entity.ReminderEntity
import com.aslam.mediareminder.data.db.entity.ReminderProfileEntity
import com.aslam.mediareminder.diagnostics.NativeLogger
import com.aslam.mediareminder.media.MediaStorage
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID
import java.util.zip.ZipFile

data class BackupInspectionResult(
    val operationId: String,
    val importToken: String,
    val archiveVersion: String,
    val createdAt: String,
    val sourceAppVersion: String,
    val mediaCount: Int,
    val reminderCount: Int,
    val compressedBytes: Long,
    val expectedUncompressedBytes: Long,
    val checksumStatus: String,
    val compatibility: String,
    val conflicts: List<BackupConflict>,
    val warnings: List<String>,
)

data class BackupCommitResult(val status: String, val affectedCount: Int)

/**
 * MR-10 "Import phases" / "Atomicity and rollback" orchestrator. Owns the
 * `operation_journal` row for the whole lifecycle so a crash mid-restore is
 * recoverable ([recoverUnfinishedOnStartup]).
 */
class BackupImporter(
    private val context: Context,
    private val database: MediaReminderDatabase,
    private val preferences: PreferencesRepository,
) {
    private val stagingRoot: File
        get() = File(context.filesDir, "backup_staging").apply { mkdirs() }

    /**
     * Import phase 1, "Acquisition." Streams the chosen archive into
     * private staging storage — the app never persists broad directory
     * access. [operationId] is caller-supplied (rather than generated here)
     * so the bridge layer can start emitting progress events tagged with it
     * before this suspend function ever returns.
     */
    suspend fun stage(operationId: String, sourceUri: String, onProgress: suspend (BackupProgress) -> Unit) {
        val now = Instant.now().toEpochMilli()
        database.operationJournalDao().upsert(
            OperationJournalEntity(
                id = operationId,
                kind = "import",
                phase = OperationJournalEntity.Phase.STAGED,
                createdAt = now,
                updatedAt = now,
            ),
        )
        onProgress(BackupProgress(phase = "acquiring"))

        val stagedFile = File(operationDir(operationId), "archive.zip")
        try {
            val resolver = context.contentResolver
            val input = resolver.openInputStream(Uri.parse(sourceUri))
                ?: throw BackupFormatException("import_source_unreadable", "Could not open the selected file")
            input.use { stream ->
                stagedFile.outputStream().use { output ->
                    val buffer = ByteArray(64 * 1024)
                    while (true) {
                        val read = stream.read(buffer)
                        if (read < 0) break
                        output.write(buffer, 0, read)
                    }
                }
            }
        } catch (error: BackupFormatException) {
            failOperation(operationId, error.reasonCode)
            throw error
        } catch (error: Exception) {
            failOperation(operationId, "import_acquisition_failed")
            throw BackupFormatException("import_acquisition_failed", "Could not read the selected file")
        }

        database.operationJournalDao().upsert(
            OperationJournalEntity(
                id = operationId,
                kind = "import",
                phase = OperationJournalEntity.Phase.STAGED,
                stagingPath = stagedFile.absolutePath,
                createdAt = now,
                updatedAt = Instant.now().toEpochMilli(),
            ),
        )
    }

    /** Import phases 2-4: structural + semantic validation, conflict plan, preview — never mutates app state. */
    suspend fun inspect(operationId: String, onProgress: suspend (BackupProgress) -> Unit): BackupInspectionResult {
        val journalEntry = database.operationJournalDao().getById(operationId)
            ?: throw BackupFormatException("import_operation_not_found", "Unknown import operation")
        val stagingPath = journalEntry.stagingPath
            ?: throw BackupFormatException("import_operation_not_staged", "Import operation has no staged archive")
        val stagedFile = File(stagingPath)
        if (!stagedFile.exists()) {
            throw BackupFormatException("import_staged_file_missing", "Staged archive is missing")
        }

        onProgress(BackupProgress(phase = "validating_structure"))
        val structural = BackupZipStructuralValidator.validate(stagedFile)
        val validated = try {
            onProgress(BackupProgress(phase = "validating_contents"))
            BackupSemanticValidator.validate(structural)
        } finally {
            structural.zipFile.close()
        }

        onProgress(BackupProgress(phase = "planning_conflicts"))
        val localProfiles = database.reminderProfileDao().getAll()
        val localReminders = database.reminderDao().getAll()
        val plan = BackupConflictPlanner.planMerge(validated, localProfiles, localReminders)

        val stagedDigest = stagedFile.inputStream().use { BackupChecksums.sha256HexStreaming(it) }
        val importToken = UUID.randomUUID().toString()

        database.operationJournalDao().upsert(
            journalEntry.copy(
                phase = OperationJournalEntity.Phase.INSPECTED,
                importToken = importToken,
                stagedDigest = stagedDigest,
                resultSummary = inspectionSummaryJson(validated, plan).toString(),
                updatedAt = Instant.now().toEpochMilli(),
            ),
        )

        return BackupInspectionResult(
            operationId = operationId,
            importToken = importToken,
            archiveVersion = validated.manifest.archiveVersion,
            createdAt = validated.manifest.createdAt,
            sourceAppVersion = validated.manifest.sourceAppVersion,
            // What will actually restore, not what the manifest claims: a
            // record whose bytes are absent from the archive is dropped by
            // the validator and must not be counted as recoverable here.
            mediaCount = validated.media.size,
            reminderCount = validated.reminders.size,
            compressedBytes = validated.compressedBytes,
            expectedUncompressedBytes = validated.expectedUncompressedBytes,
            checksumStatus = validated.checksumStatus,
            compatibility = validated.compatibility,
            conflicts = plan.conflicts,
            warnings = validated.warnings,
        )
    }

    /**
     * Import phase 5, "Commit." Re-validates the token against the staged
     * digest (MR-11 "Archive modified after inspection": "Commit rejects
     * changed bytes/token expiry and requires reinspection"), then applies
     * Merge or Replace inside one Room transaction.
     */
    suspend fun commit(operationId: String, importToken: String, mode: String): BackupCommitResult {
        val journalEntry = database.operationJournalDao().getById(operationId)
            ?: throw BackupFormatException("import_operation_not_found", "Unknown import operation")
        if (journalEntry.phase != OperationJournalEntity.Phase.INSPECTED || journalEntry.importToken != importToken) {
            throw BackupFormatException("import_token_invalid", "Import token is invalid or the operation was not inspected")
        }
        val stagingPath = journalEntry.stagingPath ?: throw BackupFormatException("import_operation_not_staged", "Import operation has no staged archive")
        val stagedFile = File(stagingPath)
        val currentDigest = stagedFile.takeIf { it.exists() }?.inputStream()?.use { BackupChecksums.sha256HexStreaming(it) }
        if (currentDigest == null || currentDigest != journalEntry.stagedDigest) {
            throw BackupFormatException("import_archive_changed", "Staged archive changed since inspection; re-inspect before committing")
        }

        markPhase(operationId, OperationJournalEntity.Phase.ROLLBACK_READY, mode = mode)

        val structural = BackupZipStructuralValidator.validate(stagedFile)
        val validated = try {
            BackupSemanticValidator.validate(structural)
        } finally {
            structural.zipFile.close()
        }
        if (validated.compatibility == "too_new" || validated.compatibility == "unsupported") {
            failOperation(operationId, "import_incompatible_version")
            throw BackupFormatException("import_incompatible_version", "This archive requires a newer app version")
        }

        val localProfiles = database.reminderProfileDao().getAll()
        val localReminders = database.reminderDao().getAll()

        var affectedCount = 0
        var mediaToPromote: List<MediaAssetEntity> = emptyList()
        database.withTransaction {
            markPhase(operationId, OperationJournalEntity.Phase.DB_PREPARED, mode = mode)

            // Media rows first: a reminder restored beside its asset resolves
            // immediately, where the reverse order would leave a window in
            // which every restored reminder read as "Media unavailable".
            mediaToPromote = restoreMediaRows(validated)

            affectedCount = when (mode) {
                "replace" -> commitReplace(validated)
                else -> commitMerge(validated, localProfiles, localReminders)
            }

            if (validated.settings != null) {
                preferences.applySnapshot(validated.settings)
            }

            markPhase(operationId, OperationJournalEntity.Phase.DB_COMMITTED, mode = mode)
        }

        // MR-10's "files promoted" phase, now doing real work: the managed
        // bytes are streamed out of the archive into `filesDir/media/`.
        //
        // After the Room commit, not before, which is the order MR-10's state
        // machine defines. The failure that order allows — a row whose bytes
        // did not make it — is now legible rather than silent: the startup
        // integrity sweep marks the asset missing, its reminders stop with
        // "Media unavailable", and Replace media repairs them. The reverse
        // order would trade that for orphaned files nothing references and
        // nothing reports.
        val promotedMedia = promoteMediaFiles(stagedFile, validated, mediaToPromote)
        if (promotedMedia != mediaToPromote.size) {
            NativeLogger.error(
                "backup.import.mediaIncomplete",
                mapOf("expected" to mediaToPromote.size, "promoted" to promotedMedia),
            )
        }
        markPhase(operationId, OperationJournalEntity.Phase.FILES_PROMOTED, mode = mode)

        SchedulerCoordinator(context, database).reconcile("backup_import_$mode")
        markPhase(operationId, OperationJournalEntity.Phase.SCHEDULED, mode = mode)

        val verifiedCount = database.reminderDao().getAll().size
        markPhase(operationId, OperationJournalEntity.Phase.VERIFIED, mode = mode)

        cleanupStaging(operationId)
        markPhase(
            operationId,
            OperationJournalEntity.Phase.COMPLETE,
            mode = mode,
            resultSummary = JSONObject().apply {
                put("affectedCount", affectedCount)
                put("totalReminders", verifiedCount)
            }.toString(),
        )

        return BackupCommitResult(status = "ok", affectedCount = affectedCount)
    }

    fun cancel(operationId: String) {
        NativeLogger.debug("backup.import.cancelRequested", mapOf("operationId" to operationId))
        // Cooperative — checked by the caller's own loop, consistent with
        // export's cancellation. Committing (once `withTransaction` has
        // started) is never interrupted mid-flight; a request arriving that
        // late is honored on the *next* operation, not this one.
    }

    /**
     * MR-11 "Crash during replace": "Startup sees operation journal,
     * prevents normal mutation and completes rollback/forward recovery."
     * Called once at process startup. Anything before `DB_COMMITTED` is
     * safe to abandon outright (Room was never touched); anything at or
     * after it rolls *forward* — finish scheduling/verification — since
     * this backup engine's Replace never leaves partial Room state readable
     * mid-transaction (the whole mutation is one `withTransaction` block).
     */
    suspend fun recoverUnfinishedOnStartup() {
        val unfinished = database.operationJournalDao().getUnfinished()
        for (entry in unfinished) {
            if (entry.phase in OperationJournalEntity.Phase.COMMITTED_OR_LATER) {
                runCatching { SchedulerCoordinator(context, database).reconcile("backup_import_recovered") }
                markPhase(entry.id, OperationJournalEntity.Phase.COMPLETE, mode = entry.mode)
            } else {
                markPhase(entry.id, OperationJournalEntity.Phase.CANCELLED, mode = entry.mode)
            }
            cleanupStaging(entry.id)
        }
    }

    // --- Commit implementations ---------------------------------------------------

    private suspend fun commitMerge(
        validated: ValidatedBackup,
        localProfiles: List<ReminderProfileEntity>,
        localReminders: List<ReminderEntity>,
    ): Int {
        val plan = BackupConflictPlanner.planMerge(validated, localProfiles, localReminders)
        val reminderDao = database.reminderDao()
        val scheduleRuleDao = database.scheduleRuleDao()
        val profileDao = database.reminderProfileDao()
        var affected = 0

        for (profile in plan.profilesToInsert) {
            profileDao.upsert(profile)
            affected += 1
        }
        for (reminder in plan.remindersToInsert) {
            reminderDao.insert(reminder)
            affected += 1
        }
        for (reminder in plan.remindersToUpdate) {
            reminderDao.update(reminder)
            affected += 1
        }
        for ((reminderId, rule) in plan.scheduleRulesToApply) {
            scheduleRuleDao.upsert(ScheduleRuleMapper.toEntity(reminderId, rule))
            database.occurrenceDao().deleteUnclaimedPendingForReminder(reminderId)
        }
        return affected
    }

    /**
     * MR-10 "Replace": "All user logical data... are replaced by archive
     * scope... reminders are recalculated and set to Needs setup/disabled
     * until capability review."
     *
     * **Media is deliberately exempt from the delete half.** Reminders and
     * profiles are logical data that the archive fully describes, so wiping
     * them is recoverable by definition — they come back from the file being
     * restored. A photo is not: deleting a user's imported media because they
     * chose "Replace" would destroy originals that may exist nowhere else,
     * with no undo. The archive's own media is still restored alongside, so a
     * Replace resolves every reminder it brings; the only visible consequence
     * is that the Library may still hold assets the archive did not mention,
     * which is the strictly safer direction to be wrong in.
     */
    private suspend fun commitReplace(validated: ValidatedBackup): Int {
        database.reminderDao().deleteAll() // cascades schedule_rules/occurrences/active_alarm_session
        database.reminderProfileDao().deleteAllCustom()

        val profileDao = database.reminderProfileDao()
        val builtInIds = setOf(
            ReminderProfileEntity.GENTLE_ID,
            ReminderProfileEntity.STANDARD_ID,
            ReminderProfileEntity.PERSISTENT_ID,
        )
        for (profile in validated.profiles) {
            if (profile.id !in builtInIds) {
                profileDao.upsert(profile)
            }
        }

        val reminderDao = database.reminderDao()
        val scheduleRuleDao = database.scheduleRuleDao()
        var affected = 0
        for (reminder in validated.reminders) {
            val rule = validated.scheduleRules[reminder.id] ?: continue
            reminderDao.insert(reminder.copy(effectiveState = ReminderEntity.STATE_NEEDS_SETUP))
            scheduleRuleDao.upsert(ScheduleRuleMapper.toEntity(reminder.id, rule))
            affected += 1
        }
        return affected
    }

    /**
     * Inserts the archive's media rows that this device does not already have.
     *
     * Skips on **either** id or storage key already being present. Id covers
     * the ordinary case of restoring a backup onto the device that made it;
     * storage key matters because the column is UNIQUE, and `MediaDao.insert`
     * is `ABORT` — one collision would roll back the entire import, not just
     * that row. Local always wins: its bytes are already on disk and known
     * good, where the archive copy would have to be re-extracted to match.
     *
     * Returns exactly the rows that were inserted, so the promote step knows
     * which files it still owes and never re-extracts bytes already present.
     */
    private suspend fun restoreMediaRows(validated: ValidatedBackup): List<MediaAssetEntity> {
        if (validated.media.isEmpty()) return emptyList()
        val mediaDao = database.mediaDao()
        val storage = MediaStorage(context)
        val existing = mediaDao.getAll()
        val existingById = existing.associateBy { it.id }
        val existingKeys = existing.mapTo(mutableSetOf()) { it.storageKey }

        val promote = mutableListOf<MediaAssetEntity>()
        for (asset in validated.media) {
            val local = existingById[asset.id]
            if (local == null) {
                // A different row already owning this storage key would abort
                // the whole transaction on the UNIQUE constraint, so skip it
                // rather than take the import down over one asset.
                if (asset.storageKey in existingKeys) continue
                mediaDao.insert(asset)
                promote += asset
            } else if (local.storageKey == asset.storageKey &&
                !storage.fileFor(local.storageKey).exists()
            ) {
                // The row is here and its bytes are not — restoring a backup
                // is exactly how `11_Edge_Cases...md` says a user repairs
                // that ("Offer Locate replacement, Restore backup or
                // Delete"), so the file is re-promoted even though the row
                // needs no insert. Without this the repair silently did
                // nothing on the one path the spec names for it.
                promote += asset
            }
            // Otherwise the local row wins: its bytes are present and known
            // good, and re-extracting them would cost a full copy to produce
            // an identical file.
        }
        return promote
    }

    /**
     * Streams each restored asset's bytes out of the archive, verifying as it
     * goes. Returns how many landed.
     *
     * Written to `<key>.part` and renamed on success, the same discipline
     * `MediaImporter` uses on the way in: a failure or a crash leaves a file
     * the suffix marks as junk and the startup sweep removes, never a
     * truncated file sitting at a real storage key a row already points at.
     *
     * The SHA-256 is checked here rather than at inspect time because this is
     * the one pass that has to read the bytes anyway — hashing a multi-
     * gigabyte archive twice to learn the same thing is not worth the wait on
     * the import screen. A mismatch drops that one file and leaves the rest of
     * the restore intact; the asset then shows as missing, which is true.
     */
    private fun promoteMediaFiles(
        archive: File,
        validated: ValidatedBackup,
        assets: List<MediaAssetEntity>,
    ): Int {
        if (assets.isEmpty()) return 0
        val storage = MediaStorage(context)
        var promoted = 0

        ZipFile(archive).use { zip ->
            for (asset in assets) {
                val path = BackupFormat.MEDIA_DIR_PREFIX + asset.storageKey
                val entry = zip.getEntry(path) ?: continue
                val partial = storage.partialFor(asset.storageKey)
                val digest = MessageDigest.getInstance(BackupFormat.HASH_ALGORITHM)

                val outcome = runCatching {
                    zip.getInputStream(entry).use { input ->
                        partial.outputStream().use { output ->
                            val buffer = ByteArray(MediaStorage.COPY_BUFFER_BYTES)
                            while (true) {
                                val read = input.read(buffer)
                                if (read < 0) break
                                output.write(buffer, 0, read)
                                digest.update(buffer, 0, read)
                            }
                        }
                    }
                    val actual = digest.digest().joinToString("") { "%02x".format(it) }
                    val declared = validated.declaredChecksums[path]
                    if (declared != null && !declared.equals(actual, ignoreCase = true)) {
                        throw BackupFormatException("media_entry_corrupt", "Media entry failed verification: " + path)
                    }
                    if (!partial.renameTo(storage.fileFor(asset.storageKey))) {
                        throw BackupFormatException("media_entry_write_failed", "Could not finalize restored media: " + path)
                    }
                }
                if (outcome.isSuccess) {
                    promoted += 1
                } else {
                    partial.delete()
                    NativeLogger.error("backup.import.mediaEntryFailed", mapOf("entry" to path), outcome.exceptionOrNull())
                }
            }
        }
        return promoted
    }

    // --- Helpers -----------------------------------------------------------------

    private fun operationDir(operationId: String): File = File(stagingRoot, operationId).apply { mkdirs() }

    private fun cleanupStaging(operationId: String) {
        operationDir(operationId).deleteRecursively()
    }

    private suspend fun failOperation(operationId: String, reasonCode: String) {
        val entry = database.operationJournalDao().getById(operationId) ?: return
        database.operationJournalDao().upsert(
            entry.copy(phase = OperationJournalEntity.Phase.FAILED, errorCode = reasonCode, updatedAt = Instant.now().toEpochMilli()),
        )
        cleanupStaging(operationId)
    }

    private suspend fun markPhase(operationId: String, phase: String, mode: String?, resultSummary: String? = null) {
        val entry = database.operationJournalDao().getById(operationId) ?: return
        database.operationJournalDao().upsert(
            entry.copy(phase = phase, mode = mode ?: entry.mode, resultSummary = resultSummary ?: entry.resultSummary, updatedAt = Instant.now().toEpochMilli()),
        )
    }

    private fun inspectionSummaryJson(validated: ValidatedBackup, plan: BackupMergePlan): JSONObject = JSONObject().apply {
        put("reminderCount", validated.reminders.size)
        put("profileCount", validated.profiles.size)
        put("conflictCount", plan.conflicts.size)
        put("conflictKinds", JSONArray(plan.conflicts.map { it.kind }))
    }
}
