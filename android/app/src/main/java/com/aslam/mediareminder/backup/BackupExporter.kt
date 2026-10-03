package com.aslam.mediareminder.backup

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.aslam.mediareminder.BuildConfig
import com.aslam.mediareminder.data.PreferencesRepository
import com.aslam.mediareminder.data.db.MediaReminderDatabase
import com.aslam.mediareminder.data.db.entity.ScheduleRuleEntity
import com.aslam.mediareminder.diagnostics.NativeLogger
import com.aslam.mediareminder.media.MediaStorage
import com.aslam.mediareminder.alarm.ScheduleRuleMapper
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.security.MessageDigest
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
 * The archive carries two kinds of entry, written two different ways.
 *
 * The JSON records are small and knowable up front, so they are built in
 * memory as a byte array each. Managed media is neither: a single asset may
 * be 2 GB, and buffering one would blow the heap the import pipeline is
 * careful never to touch (`MediaImporter` copies with a 64 KB window for the
 * same reason). Media is therefore streamed through [writeStoredFileEntry]
 * in two passes over the file — one to learn its CRC, hash and size, one to
 * write the bytes — which keeps peak memory flat regardless of asset size
 * while still producing STORED entries the reader can trust.
 *
 * This class previously claimed "No media assets exist yet", wrote an empty
 * `media-assets.json` and hardcoded every media count to zero, long after
 * media import became real. A backup that silently dropped the user's media
 * while the UI promised otherwise is the failure docs/decision-log.md DL-102
 * records; this is the other half of that fix.
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
        // Only assets whose bytes are actually present. A row whose file has
        // gone (the integrity sweep's `missing` case) would otherwise export
        // a record pointing at a `media/` entry that was never written,
        // producing an archive that restores a broken asset on the far side.
        val storage = MediaStorage(context)
        val allMedia = database.mediaDao().getAll()
        val media = allMedia.filter { storage.fileFor(it.storageKey).exists() }
        val skippedMedia = allMedia.size - media.size

        if (skippedMedia > 0) {
            // Not fatal, and not silent: these are rows whose bytes already
            // went missing on this device, so there is nothing to put in the
            // archive. The integrity sweep has already surfaced them in the app.
            NativeLogger.debug("backup.export.skippedMissingMedia", mapOf("count" to skippedMedia))
        }

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
        entries[BackupFormat.ENTRY_MEDIA_ASSETS] =
            jsonArrayBytes(media.map { BackupMediaAssetCodec.toJson(it) })
        // No category/tag data model yet — always-empty, always-present entries (see BackupRecords.kt's scope note).
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
                mediaAssets = media.size,
                reminders = reminders.size,
                profiles = profiles.size,
                categories = 0,
                tags = 0,
            ),
            totalMediaBytes = media.sumOf { it.sizeBytes }.toString(),
            hashAlgorithm = BackupFormat.HASH_ALGORITHM,
            recordsEncoding = BackupFormat.RECORDS_ENCODING,
            privacy = BackupFormat.PRIVACY_LABEL,
        )
        entries[BackupFormat.ENTRY_MANIFEST] = manifest.toJson().toString(2).toByteArray(Charsets.UTF_8)

        val destinationDir = exportDirectory()
        val fileName = "Nudgio_Backup_${filenameFormatter.format(Instant.now())}_v${BackupFormat.ARCHIVE_VERSION}.mrbackup.zip"
        val destinationFile = File(destinationDir, fileName)

        val totalItems = entries.size + media.size
        onProgress(BackupProgress(phase = "writing", currentItemIndex = 0, totalItems = totalItems))
        val checksumLines = mutableListOf<Pair<String, String>>()
        try {
            ZipOutputStream(FileOutputStream(destinationFile)).use { zip ->
                var index = 0
                for ((path, bytes) in entries) {
                    if (isCancelled()) throw BackupCancelledException()
                    writeStoredEntry(zip, path, bytes)
                    checksumLines += path to BackupChecksums.sha256Hex(bytes)
                    index += 1
                    onProgress(BackupProgress(phase = "writing", currentItemIndex = index, totalItems = totalItems))
                }
                // The bytes themselves, one entry per asset, named by the
                // same opaque storage key its record carries so the two find
                // each other on import without a second index.
                for (asset in media) {
                    if (isCancelled()) throw BackupCancelledException()
                    val path = BackupFormat.MEDIA_DIR_PREFIX + asset.storageKey
                    val digest = writeStoredFileEntry(zip, path, storage.fileFor(asset.storageKey))
                    checksumLines += path to digest
                    index += 1
                    onProgress(BackupProgress(phase = "writing", currentItemIndex = index, totalItems = totalItems))
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
            mediaCount = media.size,
        )
    }

    /** App-private, no permission required (`getExternalFilesDir` is app-scoped on API 26+, cleared with the app, never visible to other apps without a `content://` grant). Sharing a finished export uses `MediaReminderFileProvider`, never a raw path. */
    private fun exportDirectory(): File {
        val base = context.getExternalFilesDir(null) ?: context.filesDir
        val dir = File(base, "backups")
        dir.mkdirs()
        return dir
    }

    /**
     * Backup screen "Share" (MR-03/MR-10): the counterpart to
     * [com.aslam.mediareminder.media.MediaLibraryService.buildExportIntent]
     * for a single finished backup archive rather than a media selection —
     * same shape (read-only `content://` grant via the app's `FileProvider`,
     * the app's job ends once the chooser opens), just `ACTION_SEND` since
     * there is exactly one file. `fileName` is looked up by name inside the
     * one directory this class ever writes to, never a caller-supplied path,
     * so this cannot be used to share an arbitrary file. `null` means the
     * named export no longer exists (e.g. cleared by OS storage pressure
     * between the export finishing and the user tapping Share).
     */
    fun buildShareIntent(fileName: String): Intent? {
        val dir = exportDirectory()
        val file = File(dir, fileName)
        // `fileName` echoes back this class' own `ExportOutcome.fileName`, but
        // resolve-and-verify rather than trust it blindly — the same
        // path-traversal caution `BackupZipStructuralValidator` applies to
        // ZIP entry names.
        if (!file.canonicalFile.startsWith(dir.canonicalFile) || !file.isFile) return null
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        return Intent(Intent.ACTION_SEND).apply {
            type = "application/zip"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
    }

    /**
     * Streams one managed media file into the archive, returning its SHA-256
     * for `checksums.sha256`.
     *
     * Two passes over the file, deliberately. A STORED zip entry must declare
     * its size and CRC *before* any bytes are written, and the only ways to
     * know both are to buffer the whole file — impossible, assets run to
     * 2 GB — or to read it twice. Sequential reads are cheap; heap is not.
     * Peak memory stays at one 64 KB window either way, the same budget
     * `MediaImporter` holds itself to on the way in.
     *
     * STORED rather than DEFLATE because this content is already compressed
     * (JPEG, MP4, MP3): deflating it costs CPU and battery to produce a file
     * the same size or larger, and it keeps every entry in this archive
     * written one way.
     *
     * A file that changes between the two passes (the user deleting media
     * mid-export is the realistic case) fails the length check rather than
     * writing an entry whose declared size and contents disagree, which a
     * reader would reject later with a far less obvious error.
     */
    private fun writeStoredFileEntry(zip: ZipOutputStream, path: String, file: File): String {
        val crc = CRC32()
        val digest = MessageDigest.getInstance(BackupFormat.HASH_ALGORITHM)
        var size = 0L
        // The same 64 KB window `MediaImporter` copies with: one constant,
        // so the import and export paths cannot drift apart on memory budget.
        val buffer = ByteArray(MediaStorage.COPY_BUFFER_BYTES)

        file.inputStream().use { input ->
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                crc.update(buffer, 0, read)
                digest.update(buffer, 0, read)
                size += read
            }
        }

        zip.putNextEntry(
            ZipEntry(path).apply {
                method = ZipEntry.STORED
                this.size = size
                compressedSize = size
                this.crc = crc.value
            },
        )
        var written = 0L
        file.inputStream().use { input ->
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                zip.write(buffer, 0, read)
                written += read
            }
        }
        zip.closeEntry()

        if (written != size) {
            throw BackupFormatException(
                "export_media_changed",
                "A media file changed while the backup was being written",
            )
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
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

    /**
     * Says what the archive actually holds, and warns about it.
     *
     * The warning is stronger than it used to be for a real reason: this
     * archive now carries the user's actual photos, videos and audio, not
     * just JSON describing them. "Anyone with this file can read its
     * contents" was always true; "and view all of it" is what it means now.
     */
    private fun readmeBytes(): ByteArray = (
        "This is a Nudgio backup archive.\n" +
            "data/ holds your reminders, reminder profiles and app settings as plain JSON.\n" +
            "media/ holds the photos, videos and audio those reminders play, byte for byte.\n" +
            "Anyone with this file can read and view all of it - store and share it carefully.\n" +
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
