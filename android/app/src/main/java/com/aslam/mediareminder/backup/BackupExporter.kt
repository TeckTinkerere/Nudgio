package com.aslam.mediareminder.backup

import android.content.Context
import com.aslam.mediareminder.BuildConfig
import com.aslam.mediareminder.data.PreferencesRepository
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.ScheduleRuleEntity
import com.aslam.mediareminder.alarm.ScheduleRuleMapper
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.UUID
import java.util.zip.CRC32
import java.util.zip.ZipEntry
import java.util.zip.ZipFile
import java.util.zip.ZipOutputStream

/** A single reported progress tick — kept free of any RN/bridge type so `backup/` has no dependency on the bridge layer. */
data class BackupProgress(
    val phase: String,
    val currentItemIndex: Int? = null,
    val totalItems: Int? = null,
    val completedBytes: Long? = null,
    val totalBytes: Long? = null,
)

class BackupCancelledException : Exception("Export cancelled")

data class ExportOutcome(
    val file: File,
    val fileName: String,
    val sizeBytes: Long,
    val sha256: String,
    val reminderCount: Int,
    val mediaCount: Int,
)

/**
 * MR-10 "Export algorithm". Steps 1-2 (preflight display, destination
 * choice) are the JS screen's job; this class covers 3-9: create the
 * operation, snapshot Room, stream the archive, checksum it, finalize and
 * verify.
 *
 * No media assets exist yet (docs/decision-log.md, same gap as DL-012) —
 * `media/` is always empty and `totalMediaBytes` is always `"0"` today, so
 * every count and size is knowable up front. This lets the whole archive be
 * built as an in-memory byte-array-per-entry pass (all of it is small JSON)
 * rather than needing MR-10 step 7's "staging ZIP" rewrite strategy, which
 * only becomes necessary once a real media stream makes sizes unknowable
 * until the data is actually read.
 */
class BackupExporter(
    private val context: Context,
    private val database: MediaReminderDatabase,
    private val preferences: PreferencesRepository,
) {
    private val filenameFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd_HHmmss").withZone(ZoneId.systemDefault())

    suspend fun export(
        onProgress: suspend (BackupProgress) -> Unit,
        isCancelled: suspend () -> Boolean,
    ): ExportOutcome {
        onProgress(BackupProgress(phase = "preflight"))

        val reminders = database.reminderDao().getAll()
        val profiles = database.reminderProfileDao().getAll()
        val rules: Map<String, ScheduleRuleEntity> = database.scheduleRuleDao().getAll().associateBy { it.reminderId }
        val settings = preferences.readSnapshot()

        if (isCancelled()) throw BackupCancelledException()

        val entries = LinkedHashMap<String, ByteArray>()
        entries[BackupFormat.ENTRY_README] = readmeBytes()
        entries[BackupFormat.ENTRY_REMINDER_PROFILES] =
            jsonArrayBytes(profiles.map { BackupReminderProfileCodec.toJson(it) })
        entries[BackupFormat.ENTRY_REMINDERS] = jsonArrayBytes(reminders.map { BackupReminderCodec.toJson(it) })
        entries[BackupFormat.ENTRY_SCHEDULE_RULES] = jsonArrayBytes(
            reminders.mapNotNull { reminder ->
                rules[reminder.id]?.let { BackupScheduleRuleCodec.toJson(reminder.id, ScheduleRuleMapper.toDomain(it)) }
            },
        )
        entries[BackupFormat.ENTRY_SETTINGS] = BackupSettingsCodec.toJson(
            themePreference = settings.themePreference,
            useMaterialYou = settings.useMaterialYou,
            use24HourTime = settings.use24HourTime,
            languageTag = settings.languageTag,
            hasCompletedOnboarding = settings.hasCompletedOnboarding,
            defaultSnoozeMinutes = settings.defaultSnoozeMinutes,
        ).toString().toByteArray(Charsets.UTF_8)
        // No media/category/tag data model yet — always-empty, always-present entries (see BackupRecords.kt's scope note).
        entries[BackupFormat.ENTRY_MEDIA_ASSETS] = jsonArrayBytes(emptyList())
        entries[BackupFormat.ENTRY_CATEGORIES] = jsonArrayBytes(emptyList())
        entries[BackupFormat.ENTRY_TAGS] = jsonArrayBytes(emptyList())
        entries[BackupFormat.ENTRY_REMINDER_TAGS] = jsonArrayBytes(emptyList())

        val manifest = BackupManifest(
            format = BackupFormat.FORMAT_ID,
            archiveVersion = BackupFormat.ARCHIVE_VERSION,
            createdAt = Instant.now().toString(),
            sourceAppVersion = BuildConfig.VERSION_NAME,
            sourceSchemaVersion = MediaReminderDatabase.SCHEMA_VERSION,
            minimumReaderArchiveVersion = BackupFormat.MINIMUM_READER_ARCHIVE_VERSION,
            exportId = UUID.randomUUID().toString(),
            scope = BackupFormat.SCOPE_ALL,
            includesHistory = false,
            counts = BackupManifest.Counts(
                mediaAssets = 0,
                reminders = reminders.size,
                profiles = profiles.size,
                categories = 0,
                tags = 0,
            ),
            totalMediaBytes = "0",
            hashAlgorithm = BackupFormat.HASH_ALGORITHM,
            recordsEncoding = BackupFormat.RECORDS_ENCODING,
            privacy = BackupFormat.PRIVACY_LABEL,
        )
        entries[BackupFormat.ENTRY_MANIFEST] = manifest.toJson().toString(2).toByteArray(Charsets.UTF_8)

        val destinationDir = exportDirectory()
        val fileName = "Nudgio_Backup_${filenameFormatter.format(Instant.now())}_v${BackupFormat.ARCHIVE_VERSION}.mrbackup.zip"
        val destinationFile = File(destinationDir, fileName)

        onProgress(BackupProgress(phase = "writing", currentItemIndex = 0, totalItems = entries.size))
        val checksumLines = mutableListOf<Pair<String, String>>()
        try {
            ZipOutputStream(FileOutputStream(destinationFile)).use { zip ->
                var index = 0
                for ((path, bytes) in entries) {
                    if (isCancelled()) throw BackupCancelledException()
                    writeStoredEntry(zip, path, bytes)
                    checksumLines += path to BackupChecksums.sha256Hex(bytes)
                    index += 1
                    onProgress(BackupProgress(phase = "writing", currentItemIndex = index, totalItems = entries.size))
                }
                // Step 6-8: checksums.sha256 covers "every file except itself" — written last, after every other entry's hash is known.
                val checksumBytes = BackupChecksums.buildChecksumFile(checksumLines)
                writeStoredEntry(zip, BackupFormat.ENTRY_CHECKSUMS, checksumBytes)
            }
        } catch (cancelled: BackupCancelledException) {
            // MR-10: "Cancellation deletes... the partial destination where the provider permits."
            destinationFile.delete()
            throw cancelled
        } catch (error: Exception) {
            destinationFile.delete()
            throw error
        }

        onProgress(BackupProgress(phase = "finalizing"))
        // Step 9: verify the central directory is actually readable before declaring success.
        verifyZip(destinationFile)

        val archiveHash = destinationFile.inputStream().use { BackupChecksums.sha256HexStreaming(it) }

        return ExportOutcome(
            file = destinationFile,
            fileName = fileName,
            sizeBytes = destinationFile.length(),
            sha256 = archiveHash,
            reminderCount = reminders.size,
            mediaCount = 0,
        )
    }

    /** App-private, no permission required (`getExternalFilesDir` is app-scoped on API 26+, cleared with the app, never visible to other apps without a `content://` grant). Sharing a finished export uses `MediaReminderFileProvider`, never a raw path. */
    private fun exportDirectory(): File {
        val base = context.getExternalFilesDir(null) ?: context.filesDir
        val dir = File(base, "backups")
        dir.mkdirs()
        return dir
    }

    private fun writeStoredEntry(zip: ZipOutputStream, path: String, bytes: ByteArray) {
        // STORED (uncompressed) for JSON entries this small keeps the writer
        // simple (no separate compressed-size bookkeeping) and sidesteps any
        // compression-ratio ambiguity on the read side entirely for this
        // archive's own output — the *importer* still enforces the
        // compression-ratio bomb check generally, since a hostile archive
        // from elsewhere is free to use DEFLATE.
        val entry = ZipEntry(path).apply {
            method = ZipEntry.STORED
            size = bytes.size.toLong()
            compressedSize = bytes.size.toLong()
            crc = CRC32().apply { update(bytes) }.value
        }
        zip.putNextEntry(entry)
        zip.write(bytes)
        zip.closeEntry()
    }

    private fun jsonArrayBytes(objects: List<JSONObject>): ByteArray =
        JSONArray(objects).toString().toByteArray(Charsets.UTF_8)

    private fun readmeBytes(): ByteArray = (
        "This is a Nudgio backup archive.\n" +
            "It contains your reminders, reminder profiles and app settings as plain JSON files, " +
            "plus any media/thumbnails you have added to the app.\n" +
            "Anyone with this file can read its contents — store and share it carefully.\n" +
            "Restore it from Nudgio's Import screen.\n"
        ).toByteArray(Charsets.UTF_8)

    private fun verifyZip(file: File) {
        try {
            ZipFile(file).use { zipFile ->
                if (zipFile.size() == 0) {
                    throw BackupFormatException("export_verify_empty", "Exported archive has no entries")
                }
            }
        } catch (error: Exception) {
            throw BackupFormatException("export_verify_failed", "Exported archive failed to reopen for verification")
        }
    }
}
