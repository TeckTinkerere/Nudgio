package com.aslam.mediareminder.media

import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.zip.Deflater
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

/**
 * Writes the zip that Library "Share" hands to the OS when more than one file
 * (or any folder) is selected. A plain zip of the files under their Library
 * folder names, not a backup archive: no manifest, no checksums file, nothing
 * Nudgio-specific, so it opens in any file manager or on a computer.
 *
 * Photos, video and audio are already compressed, so entries are written
 * with compression level 0. That keeps the single streaming pass (no second
 * read to learn a size and CRC up front, which STORED entries would need) and
 * costs no CPU, while still being an ordinary, widely readable zip. Memory
 * stays at one [MediaStorage.COPY_BUFFER_BYTES] window whatever the file size.
 */
object ShareZipWriter {

    data class Entry(val path: String, val file: File, val modifiedAt: Long)

    /**
     * Writes every entry whose source still exists to [destination] and
     * returns how many that was. A source that vanished between planning and
     * writing is skipped rather than failing the whole share. On any error
     * the partial [destination] is deleted and the error rethrown, so a failed
     * share never leaves a truncated zip in the cache.
     */
    fun write(entries: List<Entry>, destination: File): Int {
        var written = 0
        try {
            ZipOutputStream(BufferedOutputStream(FileOutputStream(destination))).use { zip ->
                zip.setLevel(Deflater.NO_COMPRESSION)
                val buffer = ByteArray(MediaStorage.COPY_BUFFER_BYTES)
                for (entry in entries) {
                    if (!entry.file.exists()) continue
                    zip.putNextEntry(ZipEntry(entry.path).apply { time = entry.modifiedAt })
                    entry.file.inputStream().use { input ->
                        while (true) {
                            val read = input.read(buffer)
                            if (read < 0) break
                            zip.write(buffer, 0, read)
                        }
                    }
                    zip.closeEntry()
                    written += 1
                }
            }
        } catch (error: Exception) {
            destination.delete()
            throw error
        }
        if (written == 0) destination.delete()
        return written
    }
}
