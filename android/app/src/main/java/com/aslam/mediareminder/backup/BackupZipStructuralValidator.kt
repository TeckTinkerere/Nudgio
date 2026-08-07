package com.aslam.mediareminder.backup

import java.io.File
import java.util.zip.ZipEntry
import java.util.zip.ZipException
import java.util.zip.ZipFile

/**
 * MR-10 import phase 2, "Structural validation" — every check here runs
 * against the ZIP's central directory only, before a single byte of any
 * entry is trusted or extracted.
 *
 * Known, documented gap (docs/decision-log.md): "reject symlink-like
 * entries" is not implemented. `java.util.zip.ZipEntry`'s public API does
 * not expose the Unix external-attributes field a symlink is encoded in —
 * only Apache Commons Compress does, which is not a dependency here and was
 * not added for this one check (see DL-004's standing caution about adding
 * dependencies that cannot be compiled/verified in this environment). Every
 * other structural defense (traversal, absolute paths, duplicates, entry
 * count, size caps, compression-ratio bombs, unsupported compression
 * methods) is fully implemented below.
 */
object BackupZipStructuralValidator {

    data class ValidatedEntry(val name: String, val uncompressedSize: Long, val compressedSize: Long)

    data class StructuralResult(
        val zipFile: ZipFile,
        val entries: List<ValidatedEntry>,
        val warnings: List<String>,
    )

    /**
     * The single place [ZipFile] gets closed on any rejection path. Every
     * individual check below is free to just `throw` — `validateEntries`'s
     * exceptions all flow through this one `catch`, so a new check added
     * later can never reintroduce a leaked file descriptor by forgetting a
     * `zipFile.close()` call the way one rejection path here once did
     * (docs/decision-log.md).
     */
    fun validate(file: File): StructuralResult {
        val zipFile = try {
            ZipFile(file)
        } catch (error: ZipException) {
            throw BackupFormatException("zip_signature_invalid", "Not a valid ZIP archive")
        } catch (error: java.io.IOException) {
            throw BackupFormatException("zip_unreadable", "Archive could not be opened")
        }

        try {
            return validateEntries(zipFile)
        } catch (error: Throwable) {
            zipFile.close()
            throw error
        }
    }

    private fun validateEntries(zipFile: ZipFile): StructuralResult {
        // `ZipFile.entries()` returns a plain `java.util.Enumeration`, which
        // is not `Iterable` — collected by hand rather than assuming a
        // Kotlin-stdlib `.toList()` extension exists for it.
        val rawEntries = mutableListOf<ZipEntry>()
        val enumeration = zipFile.entries()
        while (enumeration.hasMoreElements()) {
            rawEntries += enumeration.nextElement()
        }
        if (rawEntries.size > BackupFormat.MAX_ZIP_ENTRIES) {
            throw BackupFormatException("zip_too_many_entries", "Archive has more than ${BackupFormat.MAX_ZIP_ENTRIES} entries")
        }
        if (rawEntries.isEmpty()) {
            throw BackupFormatException("zip_empty", "Archive has no entries")
        }

        val seenNormalizedNames = mutableSetOf<String>()
        var totalUncompressed = 0L
        val warnings = mutableListOf<String>()
        val validated = mutableListOf<ValidatedEntry>()
        var sawManifest = false
        var sawChecksums = false

        for (entry in rawEntries) {
            val name = entry.name
            rejectUnsafeName(name)

            val normalized = name.lowercase()
            if (!seenNormalizedNames.add(normalized)) {
                throw BackupFormatException("zip_duplicate_entry", "Duplicate or case-variant entry name: $name")
            }

            if (entry.isDirectory) continue

            if (entry.method != ZipEntry.STORED && entry.method != ZipEntry.DEFLATED) {
                throw BackupFormatException("zip_unsupported_compression", "Unsupported compression method for $name")
            }

            val uncompressedSize = entry.size
            val compressedSize = entry.compressedSize
            if (uncompressedSize < 0) {
                throw BackupFormatException("zip_missing_size", "Entry $name declares no size in the central directory")
            }
            if (name.startsWith(BackupFormat.MEDIA_DIR_PREFIX) && uncompressedSize > BackupFormat.MAX_MEDIA_ENTRY_BYTES) {
                throw BackupFormatException("zip_media_entry_too_large", "Media entry exceeds the per-file size limit: $name")
            }

            totalUncompressed += uncompressedSize
            if (totalUncompressed > BackupFormat.MAX_UNCOMPRESSED_TOTAL_BYTES) {
                throw BackupFormatException("zip_total_size_exceeded", "Archive's total uncompressed size exceeds the limit")
            }

            // Compression-ratio bomb check: only meaningful once there is a
            // real compressed size to compare against (STORED entries are
            // 1:1 by construction and never flagged).
            if (entry.method == ZipEntry.DEFLATED && compressedSize > 0) {
                val ratio = uncompressedSize.toDouble() / compressedSize.toDouble()
                if (ratio > BackupFormat.COMPRESSION_RATIO_REJECT) {
                    throw BackupFormatException("zip_compression_ratio_bomb", "Entry $name has an implausible compression ratio")
                }
                if (ratio > BackupFormat.COMPRESSION_RATIO_WARNING) {
                    warnings += "High compression ratio for $name"
                }
            }

            if (name == BackupFormat.ENTRY_MANIFEST) sawManifest = true
            if (name == BackupFormat.ENTRY_CHECKSUMS) sawChecksums = true

            validated += ValidatedEntry(name, uncompressedSize, compressedSize)
        }

        if (!sawManifest) {
            throw BackupFormatException("zip_missing_manifest", "Archive has no root manifest.json")
        }
        if (!sawChecksums) {
            // MR-11 "Checksum missing": "v1 requires checksum file; reject as
            // unsupported/incomplete, even when ZIP opens."
            throw BackupFormatException("zip_missing_checksums", "Archive has no checksums.sha256")
        }

        return StructuralResult(zipFile, validated, warnings)
    }

    private fun rejectUnsafeName(name: String) {
        if (name.isEmpty()) {
            throw BackupFormatException("zip_entry_empty_name", "Archive contains an entry with an empty name")
        }
        if (name.startsWith("/") || name.startsWith("\\")) {
            throw BackupFormatException("zip_entry_absolute_path", "Archive contains an absolute-path entry: $name")
        }
        // Drive-prefix (`C:\...`) and UNC (`\\host\...`) traversal — Windows-specific but checked unconditionally, since the archive may later be opened cross-platform.
        if (name.length >= 2 && name[1] == ':') {
            throw BackupFormatException("zip_entry_drive_prefix", "Archive contains a drive-prefixed entry: $name")
        }
        val segments = name.split('/', '\\')
        if (segments.any { it == ".." }) {
            throw BackupFormatException("zip_entry_traversal", "Archive contains a path-traversal entry: $name")
        }
        if (name.contains('\u0000')) {
            throw BackupFormatException("zip_entry_nul_byte", "Archive contains a NUL byte in an entry name: $name")
        }
    }
}
