package com.aslam.mediareminder.backup

import com.aslam.mediareminder.alarm.ScheduleRule
import com.aslam.mediareminder.data.PreferencesRepository
import com.aslam.mediareminder.data.db.entity.ReminderEntity
import com.aslam.mediareminder.data.db.entity.ReminderProfileEntity
import org.json.JSONArray
import org.json.JSONObject
import java.util.zip.ZipFile

data class ValidatedBackup(
    val manifest: BackupManifest,
    val profiles: List<ReminderProfileEntity>,
    val reminders: List<ReminderEntity>,
    val scheduleRules: Map<String, ScheduleRule>,
    val settings: PreferencesRepository.Snapshot?,
    val compatibility: String,
    val checksumStatus: String,
    val warnings: List<String>,
    val compressedBytes: Long,
    val expectedUncompressedBytes: Long,
)

/**
 * MR-10 import phase 3, "Semantic validation" — runs only after
 * [BackupZipStructuralValidator] has already approved every entry name,
 * size and compression method. Never mutates app state; the result is a
 * pure read of the archive.
 */
object BackupSemanticValidator {

    fun validate(
        structural: BackupZipStructuralValidator.StructuralResult,
    ): ValidatedBackup {
        val zipFile = structural.zipFile
        val entriesByName = structural.entries.associateBy { it.name }
        val warnings = structural.warnings.toMutableList()

        val manifestBytes = readEntryBytes(zipFile, BackupFormat.ENTRY_MANIFEST, entriesByName)
        val manifest = try {
            BackupManifest.fromJson(JSONObject(String(manifestBytes, Charsets.UTF_8)))
        } catch (error: org.json.JSONException) {
            throw BackupFormatException("manifest_malformed_json", "manifest.json is not valid JSON")
        }

        val compatibility = classifyCompatibility(manifest)
        if (compatibility == "unsupported") {
            throw BackupFormatException("manifest_wrong_format", "Archive is not a Nudgio backup")
        }
        // MR-10 "Backup acceptance BKP-004": a higher unsupported major
        // version must still produce a non-destructive result — the caller
        // (BackupImporter) is responsible for stopping at "preview only" for
        // `too_new`, not this validator throwing and losing the manifest
        // entirely. `too_new` is returned, not thrown.

        val checksumBytes = readEntryBytes(zipFile, BackupFormat.ENTRY_CHECKSUMS, entriesByName)
        val declaredChecksums = BackupChecksums.parseChecksumFile(checksumBytes)
        var checksumStatus = "valid"

        fun verifyAgainstDeclared(name: String, bytes: ByteArray) {
            val actualHash = BackupChecksums.sha256Hex(bytes)
            val declaredHash = declaredChecksums[name]
            if (declaredHash == null || !declaredHash.equals(actualHash, ignoreCase = true)) {
                checksumStatus = "invalid"
            }
        }

        fun readAndVerify(name: String): ByteArray {
            val bytes = readEntryBytes(zipFile, name, entriesByName)
            verifyAgainstDeclared(name, bytes)
            return bytes
        }

        verifyAgainstDeclared(BackupFormat.ENTRY_MANIFEST, manifestBytes)
        if (entriesByName.containsKey(BackupFormat.ENTRY_README)) {
            readAndVerify(BackupFormat.ENTRY_README)
        }

        val profilesJson = readAndVerify(BackupFormat.ENTRY_REMINDER_PROFILES)
        val remindersJson = readAndVerify(BackupFormat.ENTRY_REMINDERS)
        val scheduleRulesJson = readAndVerify(BackupFormat.ENTRY_SCHEDULE_RULES)
        val settingsJson = readAndVerify(BackupFormat.ENTRY_SETTINGS)
        // Present structurally (BackupFormat.REQUIRED_DATA_ENTRIES) but
        // always empty today — still checksum-verified for forward
        // compatibility, contents intentionally unused until a media/
        // category/tag data model exists (docs/decision-log.md).
        readAndVerify(BackupFormat.ENTRY_MEDIA_ASSETS)
        readAndVerify(BackupFormat.ENTRY_CATEGORIES)
        readAndVerify(BackupFormat.ENTRY_TAGS)
        readAndVerify(BackupFormat.ENTRY_REMINDER_TAGS)

        if (checksumStatus == "invalid") {
            throw BackupFormatException("checksum_mismatch", "One or more archive entries failed checksum verification")
        }

        val profiles = parseJsonArray(profilesJson) { BackupReminderProfileCodec.fromJson(it) }
        val reminders = parseJsonArray(remindersJson) { BackupReminderCodec.fromJson(it) }
        val scheduleRulePairs = parseJsonArray(scheduleRulesJson) { BackupScheduleRuleCodec.fromJson(it) }

        // MR-10 "Validate UUID uniqueness."
        requireUnique(profiles.map { it.id }, "profile")
        requireUnique(reminders.map { it.id }, "reminder")

        // MR-10 "Resolve every foreign key."
        val profileIds = profiles.map { it.id }.toSet()
        val reminderIds = reminders.map { it.id }.toSet()
        for (reminder in reminders) {
            if (reminder.profileId !in profileIds) {
                throw BackupFormatException("fk_unresolved_profile", "Reminder ${reminder.id} references a missing profile")
            }
        }
        val scheduleRules = mutableMapOf<String, ScheduleRule>()
        for ((reminderId, rule) in scheduleRulePairs) {
            if (reminderId !in reminderIds) {
                throw BackupFormatException("fk_unresolved_reminder", "Schedule rule references a missing reminder: $reminderId")
            }
            scheduleRules[reminderId] = rule
        }
        for (reminder in reminders) {
            if (reminder.id !in scheduleRules) {
                warnings += "Reminder ${reminder.id} has no schedule rule and will be skipped"
            }
        }

        // MR-10 "Compare declared counts/sizes to actual."
        if (manifest.counts.reminders != reminders.size) {
            warnings += "Manifest declares ${manifest.counts.reminders} reminders but archive contains ${reminders.size}"
        }
        if (manifest.counts.profiles != profiles.size) {
            warnings += "Manifest declares ${manifest.counts.profiles} profiles but archive contains ${profiles.size}"
        }

        val settings = parseSettings(settingsJson)

        val compressedBytes = structural.entries.sumOf { it.compressedSize.coerceAtLeast(0) }
        val expectedUncompressedBytes = structural.entries.sumOf { it.uncompressedSize.coerceAtLeast(0) }

        return ValidatedBackup(
            manifest = manifest,
            profiles = profiles,
            reminders = reminders,
            scheduleRules = scheduleRules,
            settings = settings,
            compatibility = compatibility,
            checksumStatus = checksumStatus,
            warnings = warnings,
            compressedBytes = compressedBytes,
            expectedUncompressedBytes = expectedUncompressedBytes,
        )
    }

    private fun classifyCompatibility(manifest: BackupManifest): String {
        if (manifest.format != BackupFormat.FORMAT_ID) return "unsupported"
        val major = manifest.archiveVersion.substringBefore('.').toIntOrNull() ?: return "unsupported"
        val minor = manifest.archiveVersion.substringAfter('.', "0").toIntOrNull() ?: 0
        if (major > BackupFormat.ARCHIVE_MAJOR_VERSION) return "too_new"
        if (major < BackupFormat.ARCHIVE_MAJOR_VERSION) return "migratable"

        val readerMinor = BackupFormat.ARCHIVE_VERSION.substringAfter('.', "0").toIntOrNull() ?: 0
        if (minor < readerMinor) return "migratable"
        if (minor == readerMinor) return "compatible"

        // minor > readerMinor: MR-10 "reader MAY accept higher minor only
        // when manifest declares current reader sufficient" — the writer
        // says so via `minimumReaderArchiveVersion`.
        val requiredMajor = manifest.minimumReaderArchiveVersion.substringBefore('.').toIntOrNull()
        val requiredMinor = manifest.minimumReaderArchiveVersion.substringAfter('.', "0").toIntOrNull() ?: 0
        val readerSufficient = requiredMajor == BackupFormat.ARCHIVE_MAJOR_VERSION && requiredMinor <= readerMinor
        return if (readerSufficient) "compatible" else "too_new"
    }

    private fun requireUnique(ids: List<String>, kind: String) {
        val seen = mutableSetOf<String>()
        for (id in ids) {
            if (!seen.add(id)) {
                throw BackupFormatException("duplicate_uuid", "Duplicate $kind id in archive: $id")
            }
        }
    }

    private fun parseSettings(bytes: ByteArray): PreferencesRepository.Snapshot? {
        return try {
            val json = JSONObject(String(bytes, Charsets.UTF_8))
            PreferencesRepository.Snapshot(
                themePreference = json.optString("themePreference", "system"),
                useMaterialYou = json.optBoolean("useMaterialYou", false),
                use24HourTime = if (json.isNull("use24HourTime") || !json.has("use24HourTime")) null else json.getBoolean("use24HourTime"),
                languageTag = if (json.isNull("languageTag") || !json.has("languageTag")) null else json.getString("languageTag"),
                hasCompletedOnboarding = json.optBoolean("hasCompletedOnboarding", false),
                defaultSnoozeMinutes = json.optInt("defaultSnoozeMinutes", 10),
            )
        } catch (error: org.json.JSONException) {
            null
        }
    }

    private fun <T> parseJsonArray(bytes: ByteArray, parse: (JSONObject) -> T): List<T> {
        val array = try {
            JSONArray(String(bytes, Charsets.UTF_8))
        } catch (error: org.json.JSONException) {
            throw BackupFormatException("data_file_malformed_json", "A data file is not valid JSON")
        }
        val result = mutableListOf<T>()
        for (index in 0 until array.length()) {
            result += parse(array.getJSONObject(index))
        }
        return result
    }

    /**
     * Reads at most [BackupFormat.MAX_AGGREGATE_JSON_BYTES] regardless of
     * what the central directory *declares* — a hostile archive's declared
     * `size` is not trusted on its own (that check already happened in
     * [BackupZipStructuralValidator]); this is the live, can't-be-lied-to
     * bound on the actual decompressed byte stream.
     */
    private fun readEntryBytes(zipFile: ZipFile, name: String, entries: Map<String, BackupZipStructuralValidator.ValidatedEntry>): ByteArray {
        val validated = entries[name] ?: throw BackupFormatException("zip_required_entry_missing", "Archive is missing required entry: $name")
        if (validated.uncompressedSize > BackupFormat.MAX_AGGREGATE_JSON_BYTES) {
            throw BackupFormatException("zip_entry_too_large", "Entry $name exceeds the maximum size for a JSON/manifest entry")
        }
        val zipEntry = zipFile.getEntry(name) ?: throw BackupFormatException("zip_required_entry_missing", "Archive is missing required entry: $name")
        val limit = BackupFormat.MAX_AGGREGATE_JSON_BYTES
        val buffer = java.io.ByteArrayOutputStream()
        zipFile.getInputStream(zipEntry).use { input ->
            val chunk = ByteArray(64 * 1024)
            var total = 0L
            while (true) {
                val read = input.read(chunk)
                if (read < 0) break
                total += read
                if (total > limit) {
                    throw BackupFormatException("zip_entry_stream_exceeded_declared_size", "Entry $name decompressed beyond its declared size")
                }
                buffer.write(chunk, 0, read)
            }
        }
        return buffer.toByteArray()
    }
}
