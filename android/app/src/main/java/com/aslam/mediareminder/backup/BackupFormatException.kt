package com.aslam.mediareminder.backup

/**
 * Any structural or semantic reason an archive cannot be trusted (MR-10
 * import phases 2-3). [reasonCode] is a stable identifier
 * (`NativeErrorEnvelope`'s `field`/message-key material), never a raw
 * message that might embed a path or other detail unsafe to surface as-is.
 */
class BackupFormatException(val reasonCode: String, message: String) : Exception(message)
