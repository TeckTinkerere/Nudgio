package com.aslam.mediareminder.backup

import java.io.InputStream
import java.io.OutputStream
import java.security.MessageDigest

/**
 * The two per-entry rules a restored media file must pass, kept free of
 * Android types so JVM tests can drive them with plain streams.
 *
 * [BackupZipStructuralValidator] bounds an entry against the size its own
 * header *declares*, and a hostile archive controls that header. These checks
 * run against what the stream really yields (SEC-02) and against the
 * checksum list the archive carries (SEC-04).
 */
object BackupMediaStream {

    /**
     * Copies [input] to [output], updating [digest], and fails as soon as the
     * bytes written pass the entry's declared size or
     * [BackupFormat.MAX_MEDIA_ENTRY_BYTES], whichever is smaller. Returns the
     * byte count on success.
     *
     * The check runs before each write, so at most one buffer past the cap is
     * ever read and none of it reaches disk. A stream that comes up *short*
     * of the declared size is not an error here: the SHA-256 comparison
     * catches that.
     */
    fun copyBounded(
        input: InputStream,
        output: OutputStream,
        digest: MessageDigest,
        declaredSize: Long,
        path: String,
        bufferSize: Int,
    ): Long {
        val cap = if (declaredSize in 0..BackupFormat.MAX_MEDIA_ENTRY_BYTES) {
            declaredSize
        } else {
            BackupFormat.MAX_MEDIA_ENTRY_BYTES
        }
        val buffer = ByteArray(bufferSize)
        var copied = 0L
        while (true) {
            val read = input.read(buffer)
            if (read < 0) break
            copied += read
            if (copied > cap) {
                throw BackupFormatException(
                    "media_entry_oversize",
                    "Media entry is larger than it declares: $path",
                )
            }
            output.write(buffer, 0, read)
            digest.update(buffer, 0, read)
        }
        return copied
    }

    /**
     * A media entry must have a line in `checksums.sha256` and it must match
     * (SEC-04). JSON entries already fail on a missing line; media used to
     * pass, so an entry the archive never vouched for was restored unchecked.
     */
    fun requireMatchingChecksum(path: String, declared: String?, actualHex: String) {
        if (declared == null || !declared.equals(actualHex, ignoreCase = true)) {
            throw BackupFormatException("media_entry_corrupt", "Media entry failed verification: $path")
        }
    }
}
