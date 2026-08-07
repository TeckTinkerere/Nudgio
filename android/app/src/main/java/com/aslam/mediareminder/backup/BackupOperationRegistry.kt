package com.aslam.mediareminder.backup

import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

/**
 * MR-10 "Cancellation" — an in-memory, process-lifetime cooperative
 * cancellation flag per operation. Cooperative, not a hard interrupt:
 * [BackupExporter]/[BackupImporter] check it at safe boundaries (between
 * entries/records), matching MR-06's precedent for `AlarmRingingService`'s
 * own cooperative cancellation. Deliberately not persisted — an operation
 * cancelled mid-flight simply fails and cleans up; there is nothing to
 * resume, unlike the durable `operation_journal` phase tracking that exists
 * for crash recovery.
 */
object BackupOperationRegistry {
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
