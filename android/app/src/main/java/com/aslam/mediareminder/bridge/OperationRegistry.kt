package com.aslam.mediareminder.bridge

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

/**
 * MR-10 "Cancellation": a single in-memory, process-lifetime cooperative
 * cancellation flag per operation id, shared by every long-running bridge
 * operation — backup export/import (via [com.aslam.mediareminder.backup.BackupOperationRegistry],
 * which adapts onto this) and media import.
 *
 * Extracted for the same reason as [OperationProgressEmitter]: `cancelOperation`
 * is one bridge method that accepts *any* operation id regardless of kind, so
 * the registry it checks has to be one shared map, not one per feature — two
 * registries would mean a media-import id and a backup id could never both be
 * outstanding without one of them silently checking the wrong map.
 *
 * Cooperative, not a hard interrupt: callers check [isCancelled] at safe
 * boundaries (between copy-buffer chunks, between archive entries). Not
 * persisted — an operation cancelled mid-flight simply fails and cleans up;
 * there is nothing to resume, unlike the durable `operation_journal` phase
 * tracking that exists for crash recovery.
 */
object OperationRegistry {
    private val cancelled = ConcurrentHashMap<String, AtomicBoolean>()

    fun register(operationId: String) {
        cancelled[operationId] = AtomicBoolean(false)
    }

    fun requestCancellation(operationId: String) {
        cancelled[operationId]?.set(true)
    }

    fun isCancelled(operationId: String): Boolean = cancelled[operationId]?.get() ?: false

    fun clear(operationId: String) {
        cancelled.remove(operationId)
    }
}
