package com.aslam.mediareminder.backup

import com.aslam.mediareminder.bridge.OperationRegistry

/**
 * Adapts the backup call sites onto the shared [OperationRegistry].
 *
 * Kept as its own entry point so `MediaReminderModule`'s backup methods read
 * in backup terms. The actual cancellation-flag map lives in
 * [OperationRegistry] — see that object's doc for why one shared registry,
 * not one per feature, is required: `cancelOperation` accepts any operation
 * id regardless of kind, media import included, so a second registry would
 * mean a media-import id and a backup id could never both be outstanding
 * without one of them silently checking the wrong map.
 */
object BackupOperationRegistry {
    fun register(operationId: String) = OperationRegistry.register(operationId)
    fun requestCancellation(operationId: String) = OperationRegistry.requestCancellation(operationId)
    fun isCancelled(operationId: String): Boolean = OperationRegistry.isCancelled(operationId)
    fun clear(operationId: String) = OperationRegistry.clear(operationId)
}
