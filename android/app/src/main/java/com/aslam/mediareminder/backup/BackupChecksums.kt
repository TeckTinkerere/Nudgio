package com.aslam.mediareminder.backup

import java.security.MessageDigest

/**
 * MR-10 "Checksums": `checksums.sha256` uses "a canonical two-space
 * separator and relative POSIX path" — the same line shape the standard
 * `sha256sum` tool produces, so the archive is independently verifiable
 * with common tools, not just this app.
 */
object BackupChecksums {
    fun sha256Hex(bytes: ByteArray): String =
        MessageDigest.getInstance(BackupFormat.HASH_ALGORITHM).digest(bytes).joinToString("") { "%02x".format(it) }

    fun sha256HexStreaming(input: java.io.InputStream): String {
        val digest = MessageDigest.getInstance(BackupFormat.HASH_ALGORITHM)
        val buffer = ByteArray(64 * 1024)
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            digest.update(buffer, 0, read)
        }
        return digest.digest().joinToString("") { "%02x".format(it) }
    }

    /** `path` is always the POSIX-style, forward-slash, archive-relative entry name — never a filesystem path. */
    fun formatLine(hashHex: String, path: String): String = "$hashHex  $path\n"

    fun buildChecksumFile(entries: List<Pair<String, String>>): ByteArray =
        entries.sortedBy { it.first }.joinToString("") { (path, hash) -> formatLine(hash, path) }.toByteArray(Charsets.UTF_8)

    /** Parses `checksums.sha256` back into path -> hash. Malformed lines are ignored — an importer decides separately whether a *missing* entry for a required path is fatal. */
    fun parseChecksumFile(bytes: ByteArray): Map<String, String> {
        val text = String(bytes, Charsets.UTF_8)
        val result = mutableMapOf<String, String>()
        for (rawLine in text.lineSequence()) {
            val line = rawLine.trimEnd('\r')
            if (line.isBlank()) continue
            val separatorIndex = line.indexOf("  ")
            if (separatorIndex <= 0) continue
            val hash = line.substring(0, separatorIndex)
            val path = line.substring(separatorIndex + 2)
            if (hash.isNotBlank() && path.isNotBlank()) {
                result[path] = hash.lowercase()
            }
        }
        return result
    }
}
